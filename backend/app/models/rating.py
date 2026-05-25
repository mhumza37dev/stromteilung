"""
Star rating tied to a real prior `Inquiry`.

A user can rate any other user (buyers rate sellers, sellers rate buyers),
but only after they've actually contacted them. The unique constraint on
`(rater_id, target_id, inquiry_id)` enforces "one rating per interaction" —
no spamming five-stars to the same seller across reloads.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Rating(Base):
    """1–5 star rating between two users."""

    __tablename__ = "ratings"
    __table_args__ = (
        CheckConstraint("stars BETWEEN 1 AND 5", name="stars_range"),
        UniqueConstraint(
            "rater_id", "target_id", "inquiry_id",
            name="one_rating_per_interaction",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NULL only for the seed data — production ratings must reference an
    # inquiry. Enforced at the service layer, not the schema, because we
    # want to backfill historical ratings without inquiries during data
    # migrations.
    inquiry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inquiries.id", ondelete="SET NULL"),
        nullable=True,
    )

    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    text_body: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Rating id={self.id} {self.stars}★ rater={self.rater_id} target={self.target_id}>"
