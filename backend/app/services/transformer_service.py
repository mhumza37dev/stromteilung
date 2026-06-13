"""
Transformer resolution — translates a user-typed code into a row, creating
one on the fly when the code is unknown.

The reference UX treats transformer codes as free text (users read them off
their electricity bill). Pre-seeding every German transformer isn't
practical, so we lazily materialise a `Transformer` row the first time a
code shows up. The geo of an auto-created row is the user's own location;
that keeps the 500m radius query working for everyone on the same code.
"""
from __future__ import annotations

from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transformer import Transformer
from app.repositories.transformer_repo import TransformerRepository


def _extract_city(address: str | None) -> str:
    """
    Cheap city heuristic for Nominatim `display_name` strings, which look
    like "Street, Suburb, City, District, State, Postcode, Country". We
    drop the trailing country + any all-numeric (postcode) segments and
    take the next-to-last remaining part — usually the city / town.

    Always returns *something* (the column is NOT NULL); falls back to a
    sentinel so auto-created rows are easy to spot in admin tooling.
    """
    if not address:
        return "User-defined"
    parts = [p.strip() for p in address.split(",") if p.strip()]
    candidates = [p for p in parts if not p.replace(" ", "").isdigit()]
    if len(candidates) >= 2:
        return candidates[-2][:120]
    if candidates:
        return candidates[0][:120]
    return "User-defined"


async def get_or_create_transformer(
    session: AsyncSession,
    *,
    code: str | None,
    lat: float | None,
    lng: float | None,
    address: str | None = None,
) -> Transformer | None:
    """
    Resolve a user-supplied code to a Transformer row.

    - Empty/None code → returns None (caller stores `transformer_id = NULL`).
    - Code exists → returns the existing row.
    - Code is new + we have lat/lng → creates the row pinned at (lat, lng)
      and returns it.
    - Code is new + no lat/lng → returns None. We can't satisfy the NOT NULL
      `geo` constraint, so we silently skip the link rather than 4xx-ing the
      whole upsert. The frontend can prompt the user to set a location first.
    """
    if not code:
        return None

    repo = TransformerRepository(session)
    existing = await repo.get_by_code(code)
    if existing is not None:
        return existing

    if lat is None or lng is None:
        return None

    # `transformers.geo` is NOT NULL, so it must be set on the INSERT itself
    # — a post-flush UPDATE would never get the chance. WKTElement is the
    # same pattern used by the seed script for this column.
    new_row = Transformer(
        code=code,
        city=_extract_city(address),
        geo=WKTElement(f"POINT({lng} {lat})", srid=4326),
    )
    session.add(new_row)
    await session.flush()
    return new_row
