"""
Pydantic schemas for the `/users` controller.

`UserPublic` is re-exported from `schemas.auth` so we keep a single canonical
shape for the user object — controllers should use that everywhere.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.user import Locale
from app.schemas.auth import UserPublic

__all__ = ["UserPublic", "UserUpdate"]


class UserUpdate(BaseModel):
    """Body for `PATCH /users/me` — every field is optional."""

    locale: Locale | None = None
    # Profile-level fields (whatsapp, address, transformer) land on a separate
    # `Profile` table in M3; this schema is intentionally narrow for now.

    model_config = {
        "extra": "forbid",
        "json_schema_extra": {"example": {"locale": "en"}},
    }
