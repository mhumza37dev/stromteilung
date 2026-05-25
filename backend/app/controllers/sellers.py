"""
`/sellers/*` routes — buyer-side search.

The crown jewel of the marketplace: `GET /sellers/nearby` runs the 500m
geo query that drives the buyer dashboard.

Resolution order for the buyer's reference point:
  1. Explicit `?lat` & `?lng` in the query (lets buyers preview other areas).
  2. Their saved profile geo, if any.
  3. 422 — we have nothing to search around.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser, SessionDep
from app.core.exceptions import ValidationFailedError
from app.repositories.profile_repo import ProfileRepository
from app.schemas.marketplace import NearbySellerPublic, NearbySellersResponse
from app.services.geo_service import GeoService

router = APIRouter(prefix="/sellers", tags=["sellers"])


@router.get(
    "/nearby",
    response_model=NearbySellersResponse,
    summary="Find sellers within a radius of a point (default 500m)",
    description=(
        "If `lat`/`lng` are omitted we use the authenticated buyer's "
        "profile location. Pass `require_same_transformer=true` to enforce "
        "the strict GRO-regulation match — only sellers on the buyer's own "
        "transformer are returned."
    ),
)
async def nearby(
    session: SessionDep,
    user: CurrentUser,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_m: int = Query(default=500, ge=50, le=10_000),
    require_same_transformer: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
) -> NearbySellersResponse:
    profile_repo = ProfileRepository(session)
    profile = await profile_repo.get_by_user_id(user.id)

    # --- Resolve the buyer's reference point ---
    if lat is None or lng is None:
        if profile is None or profile.geo is None:
            raise ValidationFailedError(
                "No location supplied and the buyer has no profile location.",
                details={"hint": "Pass ?lat=...&lng=... or set your profile location first."},
            )
        # GeoAlchemy returns a WKT-ish shape; pull lon/lat out via PostGIS.
        from sqlalchemy import text
        row = (
            await session.execute(
                text("SELECT ST_Y(geo::geometry) AS lat, ST_X(geo::geometry) AS lng "
                     "FROM profiles WHERE user_id = :uid"),
                {"uid": user.id},
            )
        ).one()
        lat, lng = float(row.lat), float(row.lng)

    transformer_id: uuid.UUID | None = (
        profile.transformer_id if (profile and require_same_transformer) else None
    )

    geo = GeoService(session)
    rows = await geo.find_nearby_sellers(
        buyer_lon=lng,
        buyer_lat=lat,
        buyer_transformer_id=transformer_id,
        radius_m=radius_m,
        require_same_transformer=require_same_transformer,
        limit=limit,
    )

    items = [
        NearbySellerPublic(
            seller_id=r.seller_id,
            display_name=r.display_name,
            address_text=r.address_text,
            whatsapp_e164=r.whatsapp_e164,
            transformer_code=r.transformer_code,
            distance_m=int(round(r.distance_m)),
            day_rate=r.day_rate,
            night_rate=r.night_rate,
            capacity_kwh=r.capacity_kwh,
            listing_id=r.listing_id,
            avg_rating=r.avg_rating,
            review_count=r.review_count,
        )
        for r in rows
    ]
    return NearbySellersResponse(items=items, count=len(items))
