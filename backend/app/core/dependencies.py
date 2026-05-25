"""
FastAPI dependency factories.

All `Depends(...)` callables the rest of the app uses live here so the wiring
is visible in one place. Keeping them centralized makes it trivial to swap
implementations in tests (the AuthService factory is mocked, the rest is
covered by spinning up the test DB).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models.user import User, UserRole
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.services.auth_service import AuthService

# A short alias so signatures stay readable.
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# --- Repository factories ---------------------------------------------------

def get_user_repo(session: SessionDep) -> UserRepository:
    return UserRepository(session)


def get_refresh_token_repo(session: SessionDep) -> RefreshTokenRepository:
    return RefreshTokenRepository(session)


# --- Service factories ------------------------------------------------------

def get_auth_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repo)],
    token_repo: Annotated[RefreshTokenRepository, Depends(get_refresh_token_repo)],
) -> AuthService:
    return AuthService(user_repo=user_repo, token_repo=token_repo)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


# --- Auth dependencies ------------------------------------------------------

async def get_current_user(
    user_repo: Annotated[UserRepository, Depends(get_user_repo)],
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> User:
    """Resolve the current user from a `Bearer <jwt>` header.

    Raises `UnauthorizedError` for any failure — the global handler converts
    that into a 401 problem+json response.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing or malformed Authorization header.")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)

    import uuid
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise UnauthorizedError("Token has no usable subject.") from e

    user = await user_repo.get(user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Account no longer exists.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*allowed: UserRole):
    """Factory: dependency that 403s unless the user has one of the roles."""
    async def _checker(user: CurrentUser) -> User:
        if user.role not in allowed:
            from app.core.exceptions import ForbiddenError
            raise ForbiddenError("Your role can't access this endpoint.")
        return user
    return _checker


# --- Request metadata -------------------------------------------------------

def get_user_agent(
    user_agent: Annotated[str | None, Header(alias="User-Agent")] = None,
) -> str | None:
    return user_agent


def get_client_ip(request: Request) -> str | None:
    """First entry of X-Forwarded-For wins (set by the reverse proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return None
