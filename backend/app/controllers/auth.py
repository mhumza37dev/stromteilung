"""
`/auth/*` routes — register, login, refresh, logout.

Controllers are intentionally thin: parse + validate (Pydantic), call the
service, return the result. No business logic lives here.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import AuthServiceDep, get_client_ip, get_user_agent
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
    description=(
        "Registers a buyer or seller and returns an immediately-usable token "
        "pair so the frontend can skip a follow-up login round-trip."
    ),
)
async def register(
    body: RegisterRequest,
    auth: AuthServiceDep,
    user_agent: Annotated[str | None, Depends(get_user_agent)],
    ip: Annotated[str | None, Depends(get_client_ip)],
) -> AuthResponse:
    return await auth.register(
        email=body.email,
        password=body.password,
        role=body.role,
        locale=body.locale,
        user_agent=user_agent,
        ip=ip,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Exchange email + password for a token pair",
)
async def login(
    body: LoginRequest,
    auth: AuthServiceDep,
    user_agent: Annotated[str | None, Depends(get_user_agent)],
    ip: Annotated[str | None, Depends(get_client_ip)],
) -> AuthResponse:
    return await auth.login(
        email=body.email,
        password=body.password,
        user_agent=user_agent,
        ip=ip,
    )


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="Rotate the refresh token + mint a new access token",
)
async def refresh(
    body: RefreshRequest,
    auth: AuthServiceDep,
    user_agent: Annotated[str | None, Depends(get_user_agent)],
    ip: Annotated[str | None, Depends(get_client_ip)],
) -> TokenPair:
    return await auth.refresh(
        refresh_token=body.refresh_token,
        user_agent=user_agent,
        ip=ip,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the supplied refresh token",
)
async def logout(body: LogoutRequest, auth: AuthServiceDep) -> None:
    await auth.logout(refresh_token=body.refresh_token)
