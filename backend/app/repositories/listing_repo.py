"""Repository for marketplace `listings`."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.listing import Listing
from app.repositories.base import BaseRepository


class ListingRepository(BaseRepository[Listing]):
    model = Listing

    async def list_for_seller(
        self, seller_id: uuid.UUID, *, include_inactive: bool = True
    ) -> list[Listing]:
        """All listings owned by a seller; defaults to including paused ones
        so the seller's own dashboard can show them."""
        stmt = select(Listing).where(Listing.seller_id == seller_id)
        if not include_inactive:
            stmt = stmt.where(Listing.active.is_(True))
        stmt = stmt.order_by(Listing.created_at.desc())
        return list((await self.session.execute(stmt)).scalars().all())
