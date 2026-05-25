"""
Pydantic schemas for the `/listings` controller.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, condecimal


class ListingCreate(BaseModel):
    """Body for `POST /listings`."""

    day_rate: Decimal = Field(..., ge=0, le=9, decimal_places=4)
    night_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    capacity_kwh: int = Field(..., gt=0, le=100_000)


class ListingUpdate(BaseModel):
    """Body for `PATCH /listings/{id}` — every field optional."""

    day_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    night_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    capacity_kwh: int | None = Field(default=None, gt=0, le=100_000)
    active: bool | None = None

    model_config = {"extra": "forbid"}


class ListingPublic(BaseModel):
    """Response shape for a single listing."""

    id: uuid.UUID
    seller_id: uuid.UUID
    day_rate: Decimal
    night_rate: Decimal | None
    capacity_kwh: int
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
