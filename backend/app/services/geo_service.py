"""
Geo queries — the core "find sellers within 500m of my transformer" logic.

PostGIS does all the heavy lifting:
- `ST_DWithin(geo, point, meters)`  → radius filter (uses the GiST index)
- `ST_Distance(geo, point)`         → exact distance for ordering
- `geography(POINT, 4326)`          → spherical math, no flat-earth bugs

We bind raw SQL here (rather than building it with the SQLAlchemy expression
language) because the result shape is bespoke — a SELECT joining `users`,
`profiles`, `listings` and an aggregate of `ratings` per seller.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class NearbySeller:
    """One row returned by `find_nearby_sellers`."""

    seller_id: uuid.UUID
    display_name: str
    address_text: str | None
    whatsapp_e164: str | None
    transformer_code: str | None
    distance_m: float            # exact metres from the buyer
    day_rate: Decimal
    night_rate: Decimal | None
    capacity_kwh: int
    listing_id: uuid.UUID
    avg_rating: float | None
    review_count: int


# Bound once at import time. Pure-SQL because the SELECT mixes joins +
# aggregates + PostGIS function calls — clearer to read in one place than to
# assemble with the ORM.
#
# Explicit `::geography` and `::uuid` casts: asyncpg refuses to bind a NULL
# parameter unless it can statically infer the type, so we tell Postgres
# directly what each placeholder is.
_NEARBY_SQL = text(
    """
    SELECT
        u.id                AS seller_id,
        p.display_name      AS display_name,
        p.address_text      AS address_text,
        p.whatsapp_e164     AS whatsapp_e164,
        t.code              AS transformer_code,
        ST_Distance(p.geo, CAST(:buyer_geo AS geography))::float AS distance_m,
        l.id                AS listing_id,
        l.day_rate          AS day_rate,
        l.night_rate        AS night_rate,
        l.capacity_kwh      AS capacity_kwh,
        agg.avg_rating      AS avg_rating,
        COALESCE(agg.review_count, 0) AS review_count
    FROM users u
    JOIN profiles p     ON p.user_id   = u.id
    JOIN listings l     ON l.seller_id = u.id
    LEFT JOIN transformers t ON t.id   = p.transformer_id
    LEFT JOIN (
        SELECT target_id,
               AVG(stars)::float AS avg_rating,
               COUNT(*)          AS review_count
        FROM ratings
        GROUP BY target_id
    ) agg ON agg.target_id = u.id
    WHERE u.role = 'seller'
      AND u.is_active = TRUE
      AND l.active    = TRUE
      AND l.deleted_at IS NULL
      AND p.geo IS NOT NULL
      AND ST_DWithin(p.geo, CAST(:buyer_geo AS geography), :radius_m)
      AND (
          :require_same_transformer = FALSE
          OR (
              CAST(:buyer_transformer_id AS uuid) IS NOT NULL
              AND p.transformer_id = CAST(:buyer_transformer_id AS uuid)
          )
      )
    ORDER BY distance_m ASC
    LIMIT :limit
    """
)


class GeoService:
    """Geo-aware reads — currently just the buyer-side seller search."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_nearby_sellers(
        self,
        *,
        buyer_lon: float,
        buyer_lat: float,
        buyer_transformer_id: uuid.UUID | None,
        radius_m: int = 1500,
        require_same_transformer: bool = False,
        limit: int = 50,
    ) -> list[NearbySeller]:
        """
        Return active sellers within `radius_m` of `(lon, lat)`.

        When `require_same_transformer` is True we also restrict to sellers
        on the buyer's transformer — that's the strict GRO-regulation match.
        Default False so the dashboard still shows results when the buyer
        hasn't supplied their transformer number yet.
        """
        # POINT order is (lon, lat) — easy to swap if you're used to (lat, lon).
        buyer_geo = f"SRID=4326;POINT({buyer_lon} {buyer_lat})"

        result = await self.session.execute(
            _NEARBY_SQL,
            {
                "buyer_geo": buyer_geo,
                "radius_m": radius_m,
                "buyer_transformer_id": buyer_transformer_id,
                "require_same_transformer": require_same_transformer,
                "limit": limit,
            },
        )
        rows = result.mappings().all()
        return [NearbySeller(**dict(r)) for r in rows]
