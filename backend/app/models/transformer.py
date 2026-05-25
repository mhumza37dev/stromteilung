"""
Grid transformer — a low-voltage station that serves a small neighbourhood.

The 500m matching rule from the GRO regulation is anchored on this object:
buyers and sellers attached to the **same** transformer are considered local
to each other. Geo distance is the secondary filter on top.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Transformer(Base):
    """A single low-voltage transformer (e.g. `TR-2847`)."""

    __tablename__ = "transformers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    # Human-readable identifier printed on the user's electricity bill.
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    # `geography(Point, 4326)` lets PostGIS do spherical distance correctly
    # (no flat-earth approximation). Indexed below via GiST in the migration.
    geo: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Transformer {self.code} ({self.city})>"
