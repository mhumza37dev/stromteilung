"""
A buyer→seller contact event (WhatsApp click).

We record it for two reasons:

1. **Spam-proof ratings.** A `Rating` must reference a real `Inquiry` — that
   way you can't review a seller you never spoke to. Catches the most common
   form of marketplace review fraud.
2. **Analytics.** Inquiries per listing = engagement signal; pairs nicely
   with rate-limit checks ("don't let a buyer spam-click the same seller").
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Inquiry(Base):
    """One row per WhatsApp click from a buyer to a seller."""

    __tablename__ = "inquiries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Which listing prompted the contact — handy for funnel analysis. Set
    # NULL if the seller had no listing visible at the time of inquiry.
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Inquiry id={self.id} buyer={self.buyer_id} seller={self.seller_id}>"
