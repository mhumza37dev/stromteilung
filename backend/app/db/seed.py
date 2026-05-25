"""
Deterministic seed for local development.

Mirrors the frontend's `SELLERS_BY_CITY` mock data exactly (München, Berlin,
Frankfurt, Köln) so the React app sees identical results when wired up to the
real backend.

Idempotent: re-running won't crash — it skips rows whose natural key already
exists (transformer code, user email).

Run with:
    uv run python -m app.db.seed
"""
from __future__ import annotations

import asyncio
import math
import re
from dataclasses import dataclass
from decimal import Decimal

from geoalchemy2.elements import WKTElement
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.listing import Listing
from app.models.profile import Profile
from app.models.rating import Rating
from app.models.transformer import Transformer
from app.models.user import Locale, User, UserRole


# ---------------------------------------------------------------------------
# Mock data — kept in lockstep with frontend `src/data/sellers.ts`.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SeedSeller:
    """One row from the frontend's `SELLERS_BY_CITY` array."""
    name: str
    day_rate: float
    night_rate: float | None
    capacity_kwh: int
    rating: float
    reviews: int
    distance_m: int           # offset from the city transformer
    location: str             # street address
    whatsapp: str             # digits-only (E.164 minus the "+")


# (city, transformer_code, transformer_lat, transformer_lng, sellers[])
CITIES: list[tuple[str, str, float, float, list[SeedSeller]]] = [
    (
        "München", "TR-2847", 48.1486, 11.5639,
        [
            SeedSeller("Solarpark Grüntal GmbH", 0.18, 0.14, 850, 4.8, 23, 120, "Maximilianstr. 12",  "4915123456789"),
            SeedSeller("Familie Hoffmann",       0.21, None, 320, 4.5, 11, 280, "Schillerstr. 5",     "4915987654321"),
            SeedSeller("BioEnergie Koch GmbH",   0.16, 0.12, 1200, 4.9, 47, 380, "Goethestr. 18",     "4916011223344"),
            SeedSeller("Windkraft Bergmann",     0.19, None, 600, 4.3, 8,  450, "Beethovenstr. 3",    "4915566778899"),
        ],
    ),
    (
        "Berlin", "TR-1392", 52.5079, 13.3036,
        [
            SeedSeller("Solar Spandau eG",         0.17, 0.13, 920, 4.7, 34, 95,  "Kantstr. 18",       "4916055443322"),
            SeedSeller("Familie Schulze",          0.22, None, 280, 4.4, 9,  220, "Bismarckstr. 8",    "4915677889900"),
            SeedSeller("GreenWatt Berlin GmbH",    0.15, 0.11, 1400, 4.9, 52, 340, "Leibnizstr. 22",   "4915999887766"),
            SeedSeller("Windpark Charlottenburg",  0.20, None, 550, 4.2, 12, 470, "Knesebeckstr. 5",   "4916122334455"),
        ],
    ),
    (
        "Frankfurt", "TR-5104", 50.1156, 8.6711,
        [
            SeedSeller("Mainstrom AG",        0.18, 0.14, 780, 4.6, 28, 150, "Goethestr. 12",              "4915788776655"),
            SeedSeller("Familie Müller",      0.20, None, 340, 4.5, 14, 260, "Eschenheimer Anlage 4",      "4916088997744"),
            SeedSeller("EcoEnergie Hessen",   0.16, 0.12, 1100, 4.8, 41, 410, "Bockenheimer Landstr. 88",  "4915211223344"),
        ],
    ),
    (
        "Köln", "TR-3711", 50.9356, 6.9555,
        [
            SeedSeller("RheinSolar GmbH",          0.19, 0.15, 880, 4.7, 31, 110, "Beethovenstr. 14",  "4915844556677"),
            SeedSeller("Familie Krämer",           0.21, None, 310, 4.4, 10, 240, "Mozartstr. 8",      "4916177889900"),
            SeedSeller("Kölner Bürgerenergie eG",  0.17, 0.13, 1050, 4.9, 44, 350, "Aachener Str. 32", "4915933221100"),
            SeedSeller("Windkraft Rhein-Süd",      0.20, None, 620, 4.3, 11, 480, "Severinstr. 16",    "4915466778899"),
        ],
    ),
]

# Shared demo password for every seeded account.
DEMO_PASSWORD = "demo-pass-12345"

# Number of anonymous buyers we mint to back the ratings.
ANON_BUYER_COUNT = 12


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slug(name: str) -> str:
    """Cheap ASCII slug for deterministic email addresses."""
    s = name.lower()
    s = (s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
           .replace("ß", "ss"))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _offset_point(lat: float, lng: float, distance_m: int, bearing_deg: float) -> tuple[float, float]:
    """Move (lat, lng) by `distance_m` metres on `bearing_deg`. Spherical
    approximation good to a few metres at this scale — perfect for seed data."""
    R = 6_371_000.0
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lng1 = math.radians(lng)

    angular = distance_m / R
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(bearing)
    )
    lng2 = lng1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lng2)


def _distribute_stars(target_avg: float, count: int) -> list[int]:
    """Generate `count` star values that average close to `target_avg`."""
    # Simple two-bucket split between floor(avg) and ceil(avg).
    low = math.floor(target_avg)
    high = min(5, low + 1)
    if low == high:
        return [low] * count
    # solve: high_n * high + (count - high_n) * low ≈ avg * count
    high_n = round((target_avg - low) * count)
    high_n = max(0, min(count, high_n))
    return [high] * high_n + [low] * (count - high_n)


# ---------------------------------------------------------------------------
# Seeding steps
# ---------------------------------------------------------------------------

async def _ensure_user(
    session: AsyncSession,
    *,
    email: str,
    role: UserRole,
    password: str = DEMO_PASSWORD,
) -> User:
    """Return an existing user or insert one. Idempotent."""
    found = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if found is not None:
        return found
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        locale=Locale.DE,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _ensure_transformer(
    session: AsyncSession, *, code: str, city: str, lat: float, lng: float
) -> Transformer:
    """Return existing transformer or insert one. Idempotent."""
    found = (
        await session.execute(select(Transformer).where(Transformer.code == code))
    ).scalar_one_or_none()
    if found is not None:
        return found
    t = Transformer(
        code=code,
        city=city,
        geo=WKTElement(f"POINT({lng} {lat})", srid=4326),
    )
    session.add(t)
    await session.flush()
    return t


async def _seed_seller(
    session: AsyncSession,
    seller: SeedSeller,
    transformer: Transformer,
    transformer_lat: float,
    transformer_lng: float,
    bearing_deg: float,
) -> User:
    """Create the seller's user + profile + listing if not already present."""
    email = f"{_slug(seller.name)}@stromteilung.de"
    user = await _ensure_user(session, email=email, role=UserRole.SELLER)

    # --- Profile (1:1 with user) -----------------------------------------
    existing_profile = await session.get(Profile, user.id)
    if existing_profile is None:
        lat, lng = _offset_point(transformer_lat, transformer_lng, seller.distance_m, bearing_deg)
        profile = Profile(
            user_id=user.id,
            display_name=seller.name,
            whatsapp_e164=f"+{seller.whatsapp}",
            address_text=f"{seller.location}, {transformer.city}",
            transformer_id=transformer.id,
            monthly_demand_kwh=None,
            geo=WKTElement(f"POINT({lng} {lat})", srid=4326),
        )
        session.add(profile)
        await session.flush()

    # --- Listing (only one per seller for the seed) ----------------------
    has_listing = (
        await session.execute(select(Listing.id).where(Listing.seller_id == user.id).limit(1))
    ).scalar_one_or_none()
    if has_listing is None:
        listing = Listing(
            seller_id=user.id,
            day_rate=Decimal(str(seller.day_rate)),
            night_rate=Decimal(str(seller.night_rate)) if seller.night_rate is not None else None,
            capacity_kwh=seller.capacity_kwh,
            active=True,
        )
        session.add(listing)
        await session.flush()

    return user


async def _seed_ratings(
    session: AsyncSession,
    seller_user: User,
    buyer_pool: list[User],
    *,
    target_avg: float,
    count: int,
) -> None:
    """Create `count` ratings for the seller, distributed to hit `target_avg`.

    Ratings are pinned to the buyer pool round-robin. `inquiry_id` is NULL —
    that's allowed for seed data (the model docstring explains the rationale)
    and keeps the seed lean.
    """
    existing = (
        await session.execute(text(
            "SELECT COUNT(*) FROM ratings WHERE target_id = :t"
        ), {"t": seller_user.id})
    ).scalar_one()
    if existing >= count:
        return  # already seeded enough — idempotent

    stars_seq = _distribute_stars(target_avg, count)
    # The unique constraint is (rater, target, inquiry_id). With NULL
    # inquiry_id, Postgres treats every row as distinct — so the same buyer
    # can leave multiple seed ratings if we exceed the pool size.
    for i, stars in enumerate(stars_seq[existing:], start=existing):
        rater = buyer_pool[i % len(buyer_pool)]
        rating = Rating(
            rater_id=rater.id,
            target_id=seller_user.id,
            inquiry_id=None,
            stars=stars,
            text_body=None,
        )
        session.add(rating)
    await session.flush()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def seed_all() -> None:
    async with SessionLocal() as session:
        # Anonymous buyer pool — backs the ratings.
        buyer_pool: list[User] = []
        for i in range(ANON_BUYER_COUNT):
            buyer_pool.append(
                await _ensure_user(
                    session,
                    email=f"anon-buyer-{i:02d}@stromteilung.de",
                    role=UserRole.BUYER,
                )
            )

        for city, tcode, tlat, tlng, sellers in CITIES:
            transformer = await _ensure_transformer(
                session, code=tcode, city=city, lat=tlat, lng=tlng
            )
            # Spread sellers evenly around the transformer.
            n = len(sellers)
            for i, seller in enumerate(sellers):
                bearing = (360.0 / n) * i
                user = await _seed_seller(
                    session, seller, transformer, tlat, tlng, bearing
                )
                await _seed_ratings(
                    session,
                    user,
                    buyer_pool,
                    target_avg=seller.rating,
                    count=seller.reviews,
                )

        await session.commit()
        print("✓ seed complete")


if __name__ == "__main__":
    asyncio.run(seed_all())
