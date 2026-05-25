"""
`/inquiries/*` routes — record buyer→seller WhatsApp clicks.

Rate-limited at the application layer (one inquiry per buyer/seller pair per
hour) so the table doesn't fill with duplicate events. Reuse the existing
inquiry rather than creating a new one — that way the subsequent rating
still has a valid `inquiry_id` to point at.
"""
from __future__ import annotations

from fastapi import APIRouter, status

from app.core.dependencies import CurrentUser, SessionDep, require_role
from app.core.exceptions import NotFoundError
from app.models.inquiry import Inquiry
from app.models.user import UserRole
from app.repositories.inquiry_repo import InquiryRepository
from app.repositories.user_repo import UserRepository
from app.schemas.marketplace import InquiryCreate, InquiryPublic

router = APIRouter(prefix="/inquiries", tags=["inquiries"])


@router.post(
    "",
    response_model=InquiryPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Record a WhatsApp click from buyer to seller",
)
async def create_inquiry(
    body: InquiryCreate,
    session: SessionDep,
    user: CurrentUser,
    _buyer=require_role(UserRole.BUYER, UserRole.ADMIN),
) -> InquiryPublic:
    users = UserRepository(session)
    seller = await users.get(body.seller_id)
    if seller is None or seller.role != UserRole.SELLER or not seller.is_active:
        raise NotFoundError("Seller not found.")

    inquiries = InquiryRepository(session)
    # Dedupe: if there's already a recent inquiry for this pair, return it.
    existing = await inquiries.recent_between(
        buyer_id=user.id, seller_id=body.seller_id
    )
    if existing is not None:
        return InquiryPublic.model_validate(existing)

    inquiry = Inquiry(
        buyer_id=user.id,
        seller_id=body.seller_id,
        listing_id=body.listing_id,
    )
    await inquiries.add(inquiry)
    return InquiryPublic.model_validate(inquiry)


@router.get(
    "",
    response_model=list[InquiryPublic],
    summary="List the authenticated buyer's own inquiries",
)
async def list_my_inquiries(
    session: SessionDep,
    user: CurrentUser,
) -> list[InquiryPublic]:
    repo = InquiryRepository(session)
    rows = await repo.list_for_buyer(user.id)
    return [InquiryPublic.model_validate(r) for r in rows]
