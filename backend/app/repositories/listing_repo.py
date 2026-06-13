"""Repository for marketplace `listings`."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.models.listing import Listing
from app.repositories.base import BaseRepository


class ListingRepository(BaseRepository[Listing]):
    model = Listing

    async def list_for_seller(
        self, seller_id: uuid.UUID, *, include_inactive: bool = True
    ) -> list[Listing]:
        """Live (non-soft-deleted) listings owned by a seller; defaults to
        including paused ones so the seller's own dashboard can show them."""
        stmt = (
            select(Listing)
            .where(Listing.seller_id == seller_id)
            .where(Listing.deleted_at.is_(None))
        )
        if not include_inactive:
            stmt = stmt.where(Listing.active.is_(True))
        stmt = stmt.order_by(Listing.created_at.desc())
        return list((await self.session.execute(stmt)).scalars().all())

    async def soft_delete(self, listing: Listing) -> None:
        """Mark a single listing deleted. Idempotent — re-deleting keeps the
        original timestamp."""
        if listing.deleted_at is None:
            listing.deleted_at = datetime.now(tz=timezone.utc)
            await self.session.flush()

    async def soft_delete_all_for_seller(self, seller_id: uuid.UUID) -> int:
        """Soft-delete every live listing a seller owns — used by GDPR account
        deletion. Returns the number of rows affected."""
        now = datetime.now(tz=timezone.utc)
        stmt = (
            update(Listing)
            .where(Listing.seller_id == seller_id)
            .where(Listing.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount or 0
