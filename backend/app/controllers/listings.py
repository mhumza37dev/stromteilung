"""
`/listings/*` routes — sellers create / read / update / pause their offers.

Authorization rule: a seller can only touch listings where `seller_id == self.id`.
Enforced inline because it's a single ownership check; we'll lift it into a
dependency once we have more "I own this row" endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, SessionDep, require_role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.listing import Listing
from app.models.user import UserRole
from app.repositories.listing_repo import ListingRepository
from app.repositories.transformer_repo import TransformerRepository
from app.schemas.listing import ListingCreate, ListingPublic, ListingUpdate
from app.services.transformer_service import get_or_create_transformer

router = APIRouter(prefix="/listings", tags=["listings"])


async def _seller_profile_geo(
    seller_id: uuid.UUID, session: AsyncSession
) -> tuple[float | None, float | None]:
    """
    Pull the seller's profile lat/lng — used as a fallback when the listing
    itself doesn't carry coordinates yet (e.g. a PATCH that only changes the
    transformer code).
    """
    row = (
        await session.execute(
            text(
                "SELECT ST_Y(geo::geometry) AS lat, ST_X(geo::geometry) AS lng "
                "FROM profiles WHERE user_id = :uid AND geo IS NOT NULL"
            ),
            {"uid": seller_id},
        )
    ).first()
    if row is None:
        return None, None
    return float(row.lat), float(row.lng)


async def _resolve_transformer_id(
    code: str | None,
    *,
    seller_id: uuid.UUID,
    address: str | None,
    lat: float | None,
    lng: float | None,
    session: AsyncSession,
) -> uuid.UUID | None:
    """
    Translate a user-supplied transformer code to its FK id, creating the
    row on the fly if it doesn't exist yet. Prefers the listing's own
    coordinates; falls back to the seller's profile geo so a code typed
    without re-pinning still resolves.
    """
    if not code:
        return None
    if lat is None or lng is None:
        lat, lng = await _seller_profile_geo(seller_id, session)
    transformer = await get_or_create_transformer(
        session, code=code, lat=lat, lng=lng, address=address,
    )
    return transformer.id if transformer is not None else None


async def _write_listing_geo(
    listing_id: uuid.UUID,
    lat: float,
    lng: float,
    session: AsyncSession,
) -> None:
    """
    Set `listings.geo` via ST_GeographyFromText. Same WKT-roundtrip pattern
    used for profile geo updates — keeps the asyncpg driver happy with the
    Geography column.
    """
    await session.execute(
        text(
            "UPDATE listings SET geo = ST_GeographyFromText(:p) WHERE id = :id"
        ),
        {"p": f"SRID=4326;POINT({lng} {lat})", "id": listing_id},
    )


async def _to_public(
    listing: Listing, session: AsyncSession
) -> ListingPublic:
    """
    Project a Listing into the public response, joining the transformer code
    and lifting lat/lng out of the geography column.
    """
    public = ListingPublic.model_validate(listing)
    updates: dict[str, object] = {}

    row = (
        await session.execute(
            text(
                "SELECT ST_Y(geo::geometry) AS lat, ST_X(geo::geometry) AS lng "
                "FROM listings WHERE id = :id AND geo IS NOT NULL"
            ),
            {"id": listing.id},
        )
    ).first()
    if row is not None:
        updates["latitude"] = float(row.lat)
        updates["longitude"] = float(row.lng)

    if listing.transformer_id is not None:
        transformers = TransformerRepository(session)
        transformer = await session.get(
            transformers.model, listing.transformer_id
        )
        if transformer is not None:
            updates["transformer_code"] = transformer.code

    return public.model_copy(update=updates) if updates else public


@router.get(
    "",
    response_model=list[ListingPublic],
    summary="List the authenticated seller's own listings",
)
async def list_my_listings(
    session: SessionDep,
    user: CurrentUser,
) -> list[ListingPublic]:
    repo = ListingRepository(session)
    rows = await repo.list_for_seller(user.id, include_inactive=True)
    return [await _to_public(r, session) for r in rows]


@router.post(
    "",
    response_model=ListingPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new listing (sellers only)",
    dependencies=[Depends(require_role(UserRole.SELLER, UserRole.ADMIN))],
)
async def create_listing(
    body: ListingCreate,
    session: SessionDep,
    user: CurrentUser,
) -> ListingPublic:
    repo = ListingRepository(session)
    transformer_id = await _resolve_transformer_id(
        body.transformer_code,
        seller_id=user.id,
        address=body.address_text,
        lat=body.latitude,
        lng=body.longitude,
        session=session,
    )
    listing = Listing(
        seller_id=user.id,
        day_rate=body.day_rate,
        night_rate=body.night_rate,
        capacity_kwh=body.capacity_kwh,
        address_text=body.address_text,
        transformer_id=transformer_id,
        active=True,
    )
    await repo.add(listing)
    if body.latitude is not None and body.longitude is not None:
        await _write_listing_geo(listing.id, body.latitude, body.longitude, session)
        await session.refresh(listing)
    return await _to_public(listing, session)


@router.patch(
    "/{listing_id}",
    response_model=ListingPublic,
    summary="Edit / pause / resume a listing the seller owns",
)
async def update_listing(
    listing_id: uuid.UUID,
    body: ListingUpdate,
    session: SessionDep,
    user: CurrentUser,
) -> ListingPublic:
    repo = ListingRepository(session)
    listing = await repo.get(listing_id)
    if listing is None or listing.deleted_at is not None:
        raise NotFoundError("Listing not found.")
    if listing.seller_id != user.id and user.role != UserRole.ADMIN:
        raise ForbiddenError("You can only edit your own listings.")

    updates = body.model_dump(exclude_unset=True)
    # lat/lng are persisted via raw PostGIS — pop them out of the ORM update.
    lat = updates.pop("latitude", None)
    lng = updates.pop("longitude", None)

    # `transformer_code` is a client-facing alias — translate into the FK,
    # preferring the new coords if supplied, otherwise falling back to the
    # listing's existing address for the city heuristic.
    if "transformer_code" in updates:
        code = updates.pop("transformer_code")
        updates["transformer_id"] = await _resolve_transformer_id(
            code,
            seller_id=listing.seller_id,
            address=updates.get("address_text", listing.address_text),
            lat=lat,
            lng=lng,
            session=session,
        )
    if updates:
        await repo.update(listing, **updates)
    if lat is not None and lng is not None:
        await _write_listing_geo(listing.id, lat, lng, session)
        await session.refresh(listing)
    return await _to_public(listing, session)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a listing the seller owns",
)
async def delete_listing(
    listing_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
) -> None:
    repo = ListingRepository(session)
    listing = await repo.get(listing_id)
    if listing is None or listing.deleted_at is not None:
        raise NotFoundError("Listing not found.")
    if listing.seller_id != user.id and user.role != UserRole.ADMIN:
        raise ForbiddenError("You can only delete your own listings.")
    await repo.soft_delete(listing)
