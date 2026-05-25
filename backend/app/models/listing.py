"""
A seller's energy offer.

One seller can publish **many** listings — different rate windows, different
capacity tiers. Buyers see only `active=true` listings on their dashboard.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Listing(Base):
    """Day/night price + monthly capacity offered by a seller."""

    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint("day_rate >= 0", name="day_rate_non_negative"),
        CheckConstraint(
            "night_rate IS NULL OR night_rate >= 0",
            name="night_rate_non_negative",
        ),
        CheckConstraint("capacity_kwh > 0", name="capacity_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # €/kWh, four decimal places so we can represent 0.1834 cleanly.
    day_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    night_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)

    # Monthly supply ceiling.
    capacity_kwh: Mapped[int] = mapped_column(Integer, nullable=False)

    # Paused listings stay in the DB (analytics + un-pause) but don't surface
    # to buyers.
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<Listing id={self.id} seller={self.seller_id} "
            f"day={self.day_rate} cap={self.capacity_kwh} active={self.active}>"
        )
