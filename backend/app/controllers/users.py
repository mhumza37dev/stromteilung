"""
`/users/*` routes — the authenticated user's own account and profile.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    AuthServiceDep,
    CurrentUser,
    SessionDep,
)
from app.core.exceptions import NotFoundError
from app.models.profile import Profile
from app.repositories.listing_repo import ListingRepository
from app.repositories.profile_repo import ProfileRepository
from app.repositories.transformer_repo import TransformerRepository
from app.repositories.user_repo import UserRepository
from app.schemas.marketplace import ProfilePublic, ProfileUpsert
from app.schemas.user import UserPublic, UserUpdate
from app.services.transformer_service import get_or_create_transformer

router = APIRouter(prefix="/users", tags=["users"])


async def _profile_to_public(
    profile: Profile, session: AsyncSession
) -> ProfilePublic:
    """
    Project a Profile (with PostGIS `geo`) into the public response, lifting
    lat/lng out of the geography column so the map picker can re-centre on
    the saved location and joining the transformer code for display.
    """
    public = ProfilePublic.model_validate(profile)
    updates: dict[str, object] = {}

    row = (
        await session.execute(
            text(
                "SELECT ST_Y(geo::geometry) AS lat, ST_X(geo::geometry) AS lng "
                "FROM profiles WHERE user_id = :uid AND geo IS NOT NULL"
            ),
            {"uid": profile.user_id},
        )
    ).first()
    if row is not None:
        updates["latitude"]  = float(row.lat)
        updates["longitude"] = float(row.lng)

    if profile.transformer_id is not None:
        transformers = TransformerRepository(session)
        transformer = await session.get(
            transformers.model, profile.transformer_id
        )
        if transformer is not None:
            updates["transformer_code"] = transformer.code

    return public.model_copy(update=updates) if updates else public


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
    GDPR soft-delete:
      1. Revoke every session so existing tokens stop working immediately.
      2. Mark the account inactive (login + nearby search already exclude it).
      3. Soft-delete all of the user's listings so they vanish from search.
      4. Anonymize the email — rotate it to `deleted__{email}__{ts}` so the
         original address is freed and the user can register again, while the
         row (and its history) is retained. The `(email, role)` unique
         constraint still holds because the rotated value is unique.

    Full PII scrubbing of the profile row (name, whatsapp) lands in M6.
    """
    await auth.revoke_all(user.id)

    # Soft-delete listings (sellers); no-op for buyers who own none.
    listings = ListingRepository(session)
    await listings.soft_delete_all_for_seller(user.id)

    # Anonymize the email so the original is free to register again. Guard the
    # timestamp to the email column's 320-char limit (emails are <= 254, the
    # prefix + suffix stay well under 320, but truncate defensively).
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d%H%M%S")
    anonymized = f"deleted__{user.email}__{stamp}"[:320]

    repo = UserRepository(session)
    await repo.update(user, is_active=False, email=anonymized)


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
    return await _profile_to_public(profile, session)


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

    # Resolve transformer code → id. Unknown codes are auto-created at the
    # user's pinned location so the form's free-text input matches the
    # reference UX without a separate seeding step.
    transformer = await get_or_create_transformer(
        session,
        code=body.transformer_code,
        lat=body.latitude,
        lng=body.longitude,
        address=body.address_text,
    )
    transformer_id = transformer.id if transformer is not None else None

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

    # Reload so the server-generated columns (created_at / updated_at, set via
    # server_default / onupdate=func.now()) are populated inside the async
    # context. Without this they stay expired after the flush and Pydantic's
    # synchronous model_validate would trigger a lazy load → MissingGreenlet.
    await session.refresh(existing)

    return await _profile_to_public(existing, session)
