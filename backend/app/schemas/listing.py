"""
Pydantic schemas for the `/listings` controller.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ListingCreate(BaseModel):
    """Body for `POST /listings`."""

    day_rate: Decimal = Field(..., ge=0, le=9, decimal_places=4)
    night_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    capacity_kwh: int = Field(..., gt=0, le=100_000)
    # Optional per-listing overrides — clients send a transformer *code*; the
    # controller resolves it to the FK id like profile upsert does.
    address_text: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    transformer_code: str | None = Field(default=None, max_length=32)


class ListingUpdate(BaseModel):
    """Body for `PATCH /listings/{id}` — every field optional."""

    day_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    night_rate: Decimal | None = Field(default=None, ge=0, le=9, decimal_places=4)
    capacity_kwh: int | None = Field(default=None, gt=0, le=100_000)
    active: bool | None = None
    address_text: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    transformer_code: str | None = Field(default=None, max_length=32)

    model_config = {"extra": "forbid"}


class ListingPublic(BaseModel):
    """Response shape for a single listing."""

    id: uuid.UUID
    seller_id: uuid.UUID
    day_rate: Decimal
    night_rate: Decimal | None
    capacity_kwh: int
    active: bool
    address_text: str | None = None
    # Hydrated from the listing's PostGIS POINT — null until the seller
    # explicitly pins this listing on the map.
    latitude: float | None = None
    longitude: float | None = None
    transformer_id: uuid.UUID | None = None
    # Joined from `transformers.code` for display — saves the client a lookup.
    transformer_code: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
