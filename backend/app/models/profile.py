"""
User profile — the mutable, marketplace-facing details that aren't identity.

Split from `users` so the auth-critical row stays lean (every request hits
it). Profiles change rarely and can be cached aggressively.

Each user has exactly **one** profile (1:1), enforced by `user_id` being the
PK. Profile creation happens at the end of onboarding, not at registration.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profile(Base):
    """Marketplace-facing profile attached 1:1 to a `User`."""

    __tablename__ = "profiles"

    # PK == FK; enforces the one-to-one relationship at the schema level.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    display_name: Mapped[str] = mapped_column(String(160), nullable=False)

    # Stored in E.164 ("+4915123456789") so we can hand it straight to wa.me/
    # links without further normalization.
    whatsapp_e164: Mapped[str | None] = mapped_column(String(32), nullable=True)

    address_text: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Lat/Lng resolved from the address — drives the 500m radius query.
    geo: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )

    # Optional link to the user's local transformer. Nullable because we
    # accept the profile before the user has supplied the number.
    transformer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transformers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Buyer-specific: declared monthly demand (kWh). Sellers leave this NULL.
    monthly_demand_kwh: Mapped[int | None] = mapped_column(nullable=True)

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
        return f"<Profile user_id={self.user_id} name={self.display_name!r}>"
