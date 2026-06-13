"""
The `User` aggregate root.

Profile fields (whatsapp, address, transformer …) deliberately live on a
separate `Profile` table that we'll add in M3 — keeping `users` lean means
auth queries (which run on every request) stay fast.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, enum.Enum):
    """Coarse-grained role attached to every JWT we mint."""
    BUYER = "buyer"
    SELLER = "seller"
    ADMIN = "admin"


class Locale(str, enum.Enum):
    DE = "de"
    EN = "en"


class User(Base):
    """A marketplace participant — buyer, seller or admin."""

    __tablename__ = "users"
    # Email is unique per role rather than globally — same person can have
    # both a buyer and a seller account at the same address.
    __table_args__ = (
        UniqueConstraint("email", "role", name="uq_users_email_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=False,
            length=16,
            # Store the .value ("seller") not the .name ("SELLER"); JSON
            # responses and seed SQL both use lowercase.
            values_callable=lambda members: [m.value for m in members],
        ),
        nullable=False,
        default=UserRole.BUYER,
    )
    locale: Mapped[Locale] = mapped_column(
        Enum(
            Locale,
            name="user_locale",
            native_enum=False,
            length=4,
            values_callable=lambda members: [m.value for m in members],
        ),
        nullable=False,
        default=Locale.DE,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

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
        return f"<User id={self.id} email={self.email} role={self.role.value}>"
