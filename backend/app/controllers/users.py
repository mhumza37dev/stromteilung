"""
`/users/*` routes — the authenticated user's own account and profile.
"""
from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import text

from app.core.dependencies import (
    AuthServiceDep,
    CurrentUser,
    SessionDep,
)
from app.core.exceptions import NotFoundError
from app.models.profile import Profile
from app.repositories.profile_repo import ProfileRepository
from app.repositories.transformer_repo import TransformerRepository
from app.repositories.user_repo import UserRepository
from app.schemas.marketplace import ProfilePublic, ProfileUpsert
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


# --- Account ----------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserPublic,
    summary="Return the currently authenticated user",
)
async def read_me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)


@router.patch(
    "/me",
    response_model=UserPublic,
    summary="Update fields on the authenticated user's account",
)
async def update_me(
    body: UserUpdate,
    user: CurrentUser,
    session: SessionDep,
) -> UserPublic:
    repo = UserRepository(session)
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await repo.update(user, **updates)
    return UserPublic.model_validate(user)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="GDPR delete — revoke sessions, deactivate account",
)
async def delete_me(
    user: CurrentUser,
    session: SessionDep,
    auth: AuthServiceDep,
) -> None:
    """
    Soft-delete: revoke every session and mark the account inactive. Full
    GDPR-compliant anonymization (rotate email, scrub PII columns, retain
    audit rows) lands in M6.
    """
    await auth.revoke_all(user.id)
    repo = UserRepository(session)
    await repo.update(user, is_active=False)


# --- Profile ----------------------------------------------------------------

@router.get(
    "/me/profile",
    response_model=ProfilePublic,
    summary="Return the authenticated user's marketplace profile",
)
async def read_my_profile(
    user: CurrentUser,
    session: SessionDep,
) -> ProfilePublic:
    repo = ProfileRepository(session)
    profile = await repo.get_by_user_id(user.id)
    if profile is None:
        raise NotFoundError("Profile not set up yet.")
    return ProfilePublic.model_validate(profile)


@router.put(
    "/me/profile",
    response_model=ProfilePublic,
    summary="Create or replace the authenticated user's profile",
    description=(
        "Use this at the end of onboarding and whenever the address / "
        "transformer changes. Latitude/longitude are persisted as a "
        "PostGIS POINT to drive the 500m radius query."
    ),
)
async def upsert_my_profile(
    body: ProfileUpsert,
    user: CurrentUser,
    session: SessionDep,
) -> ProfilePublic:
    profiles = ProfileRepository(session)
    transformers = TransformerRepository(session)

    # Resolve transformer code → id if supplied.
    transformer_id = None
    if body.transformer_code:
        t = await transformers.get_by_code(body.transformer_code)
        if t is None:
            raise NotFoundError(
                f"Transformer '{body.transformer_code}' not found.",
            )
        transformer_id = t.id

    existing = await profiles.get_by_user_id(user.id)
    if existing is None:
        existing = Profile(
            user_id=user.id,
            display_name=body.display_name,
            whatsapp_e164=body.whatsapp_e164,
            address_text=body.address_text,
            transformer_id=transformer_id,
            monthly_demand_kwh=body.monthly_demand_kwh,
        )
        session.add(existing)
        await session.flush()
    else:
        existing.display_name = body.display_name
        existing.whatsapp_e164 = body.whatsapp_e164
        existing.address_text = body.address_text
        existing.transformer_id = transformer_id
        existing.monthly_demand_kwh = body.monthly_demand_kwh
        await session.flush()

    # Set the geography column with PostGIS, since GeoAlchemy needs the WKT
    # representation and we have lat/lng floats here.
    if body.latitude is not None and body.longitude is not None:
        await session.execute(
            text(
                "UPDATE profiles SET geo = ST_GeographyFromText(:p) "
                "WHERE user_id = :uid"
            ),
            {
                "p": f"SRID=4326;POINT({body.longitude} {body.latitude})",
                "uid": user.id,
            },
        )
        await session.refresh(existing)

    return ProfilePublic.model_validate(existing)
