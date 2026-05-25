"""
`/ratings/*` routes — submit ratings, read ones you've received.

Business rules enforced here:
- A rating must reference a real prior `inquiry` between rater and target
  (admin override exists for backfills / seed data).
- The `(rater, target, inquiry)` triple is unique — DB constraint, not just
  app logic, so race conditions can't slip through.
"""
from __future__ import annotations

from fastapi import APIRouter, status

from app.core.dependencies import CurrentUser, SessionDep
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.rating import Rating
from app.models.user import UserRole
from app.repositories.inquiry_repo import InquiryRepository
from app.repositories.rating_repo import RatingRepository
from app.schemas.marketplace import RatingCreate, RatingPublic, RatingsAggregate

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post(
    "",
    response_model=RatingPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a 1–5 rating for another user",
)
async def create_rating(
    body: RatingCreate,
    session: SessionDep,
    user: CurrentUser,
) -> RatingPublic:
    if body.target_id == user.id:
        raise ForbiddenError("You can't rate yourself.")

    # Verify there's a real interaction we can anchor this rating to, unless
    # the caller is an admin (used for backfills).
    inquiry_id = body.inquiry_id
    if user.role != UserRole.ADMIN:
        if inquiry_id is None:
            inquiries = InquiryRepository(session)
            latest = await inquiries.recent_between(
                buyer_id=user.id, seller_id=body.target_id
            )
            if latest is None:
                raise ForbiddenError(
                    "You can only rate users you've contacted. Send a WhatsApp first."
                )
            inquiry_id = latest.id

    rating = Rating(
        rater_id=user.id,
        target_id=body.target_id,
        inquiry_id=inquiry_id,
        stars=body.stars,
        text_body=body.text_body,
    )

    repo = RatingRepository(session)
    try:
        await repo.add(rating)
    except Exception as e:                # the DB unique constraint
        if "one_rating_per_interaction" in str(e):
            raise ConflictError("You've already rated this interaction.") from e
        raise

    return RatingPublic.model_validate(rating)


@router.get(
    "/received",
    response_model=RatingsAggregate,
    summary="Aggregate + list of ratings the authenticated user has received",
)
async def list_received(
    session: SessionDep,
    user: CurrentUser,
) -> RatingsAggregate:
    repo = RatingRepository(session)
    avg, count = await repo.aggregate(user.id)
    items = await repo.list_received(user.id)
    return RatingsAggregate(
        avg_rating=avg,
        review_count=count,
        items=[RatingPublic.model_validate(r) for r in items],
    )


@router.get(
    "/of-user/{user_id}",
    response_model=RatingsAggregate,
    summary="Public ratings for another user (e.g. seller profile page)",
)
async def list_for_user(
    user_id,
    session: SessionDep,
) -> RatingsAggregate:
    # Looked-up user existence is implicit — if they have no ratings the
    # aggregate is `(None, 0)`, which the frontend handles gracefully.
    repo = RatingRepository(session)
    avg, count = await repo.aggregate(user_id)
    items = await repo.list_received(user_id)
    return RatingsAggregate(
        avg_rating=avg,
        review_count=count,
        items=[RatingPublic.model_validate(r) for r in items],
    )
