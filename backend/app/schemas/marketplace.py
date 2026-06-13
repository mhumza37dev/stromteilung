"""
Pydantic schemas for the marketplace controllers — sellers, transformers,
inquiries, ratings, profile.

Kept in one file because each is small and they're tightly related; we can
split per controller later if any of them grows.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# --- Transformers -----------------------------------------------------------

class TransformerPublic(BaseModel):
    id: uuid.UUID
    code: str
    city: str

    model_config = {"from_attributes": True}


# --- Profile ----------------------------------------------------------------

class ProfileUpsert(BaseModel):
    """Body for `PUT /users/me/profile` — full create-or-replace."""

    display_name: str = Field(..., min_length=2, max_length=160)
    whatsapp_e164: str | None = Field(default=None, max_length=32)
    address_text: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    transformer_code: str | None = Field(default=None, max_length=32)
    monthly_demand_kwh: int | None = Field(default=None, ge=0, le=100_000)


class ProfilePublic(BaseModel):
    user_id: uuid.UUID
    display_name: str
    whatsapp_e164: str | None
    address_text: str | None
    # Hydrated from the PostGIS POINT in `profiles.geo` — see users controller.
    latitude: float | None = None
    longitude: float | None = None
    transformer_id: uuid.UUID | None
    # Joined from `transformers.code` — lets the client display + reuse the
    # human-readable code (e.g. "TR-2847") without a second round-trip.
    transformer_code: str | None = None
    monthly_demand_kwh: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Sellers / nearby query -------------------------------------------------

class NearbySellerPublic(BaseModel):
    """One result row from `GET /sellers/nearby`."""

    seller_id: uuid.UUID
    display_name: str
    address_text: str | None
    whatsapp_e164: str | None
    transformer_code: str | None
    distance_m: int                       # rounded to a whole metre for UI
    day_rate: Decimal
    night_rate: Decimal | None
    capacity_kwh: int
    listing_id: uuid.UUID
    avg_rating: float | None              # null when no reviews yet
    review_count: int


class NearbySellersResponse(BaseModel):
    """Top-level response — easier to extend with metadata later (paging…)."""

    items: list[NearbySellerPublic]
    count: int


# --- Inquiries --------------------------------------------------------------

class InquiryCreate(BaseModel):
    """Body for `POST /inquiries` — recorded when buyer clicks WhatsApp."""

    seller_id: uuid.UUID
    listing_id: uuid.UUID | None = None


class InquiryPublic(BaseModel):
    id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    listing_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Ratings ----------------------------------------------------------------

class RatingCreate(BaseModel):
    """Body for `POST /ratings`."""

    target_id: uuid.UUID
    stars: int = Field(..., ge=1, le=5)
    inquiry_id: uuid.UUID | None = None   # enforced by service for real users
    text_body: str | None = Field(default=None, max_length=2000)


class RatingPublic(BaseModel):
    id: uuid.UUID
    rater_id: uuid.UUID
    target_id: uuid.UUID
    inquiry_id: uuid.UUID | None
    stars: int
    text_body: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingsAggregate(BaseModel):
    """`GET /ratings/received` returns aggregate + list together."""

    avg_rating: float | None
    review_count: int
    items: list[RatingPublic]
