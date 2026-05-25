"""
`/listings/*` routes — sellers create / read / update / pause their offers.

Authorization rule: a seller can only touch listings where `seller_id == self.id`.
Enforced inline because it's a single ownership check; we'll lift it into a
dependency once we have more "I own this row" endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.dependencies import CurrentUser, SessionDep, require_role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.listing import Listing
from app.models.user import UserRole
from app.repositories.listing_repo import ListingRepository
from app.schemas.listing import ListingCreate, ListingPublic, ListingUpdate

router = APIRouter(prefix="/listings", tags=["listings"])


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
    return [ListingPublic.model_validate(r) for r in rows]


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
    listing = Listing(
        seller_id=user.id,
        day_rate=body.day_rate,
        night_rate=body.night_rate,
        capacity_kwh=body.capacity_kwh,
        active=True,
    )
    await repo.add(listing)
    return ListingPublic.model_validate(listing)


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
    if listing is None:
        raise NotFoundError("Listing not found.")
    if listing.seller_id != user.id and user.role != UserRole.ADMIN:
        raise ForbiddenError("You can only edit your own listings.")

    updates = body.model_dump(exclude_unset=True)
    if updates:
        await repo.update(listing, **updates)
    return ListingPublic.model_validate(listing)


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
    if listing is None:
        raise NotFoundError("Listing not found.")
    if listing.seller_id != user.id and user.role != UserRole.ADMIN:
        raise ForbiddenError("You can only delete your own listings.")
    await repo.delete(listing)
