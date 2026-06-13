"""
Pydantic schemas for the auth controller surface.

These models live at the boundary — they validate incoming JSON and shape the
JSON we send back. ORM models are internal; we never leak them to clients.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.user import Locale, UserRole


# --- Requests ---------------------------------------------------------------

class RegisterRequest(BaseModel):
    """Body for `POST /auth/register`."""

    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.BUYER
    locale: Locale = Locale.DE


class LoginRequest(BaseModel):
    """Body for `POST /auth/login`.

    Role is required because email is no longer unique on its own — the same
    person can hold a buyer *and* a seller account. The login form picks
    which one to authenticate as via the existing role toggle.
    """

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    role: UserRole


class RefreshRequest(BaseModel):
    """Body for `POST /auth/refresh`."""

    refresh_token: str = Field(min_length=10, max_length=512)


class LogoutRequest(BaseModel):
    """Body for `POST /auth/logout`."""

    refresh_token: str = Field(min_length=10, max_length=512)


# --- Responses --------------------------------------------------------------

class TokenPair(BaseModel):
    """Returned by register / login / refresh."""

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # seconds — same value as `JWT_ACCESS_TTL_SECONDS`


class UserPublic(BaseModel):
    """Safe-to-expose subset of `User` — no password hash, no internal flags."""

    id: uuid.UUID
    email: EmailStr
    role: UserRole
    locale: Locale
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Wraps the token pair with the freshly-authenticated user."""

    user: UserPublic
    tokens: TokenPair
