"""Repository for buyer→seller `inquiries` (WhatsApp clicks)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select

from app.models.inquiry import Inquiry
from app.repositories.base import BaseRepository


class InquiryRepository(BaseRepository[Inquiry]):
    model = Inquiry

    async def recent_between(
        self,
        *,
        buyer_id: uuid.UUID,
        seller_id: uuid.UUID,
        window: timedelta = timedelta(hours=1),
    ) -> Inquiry | None:
        """Return the most recent inquiry between this buyer/seller pair
        inside `window`. Used to dedupe spam-clicks of the WhatsApp button."""
        cutoff = datetime.now(tz=timezone.utc) - window
        stmt = (
            select(Inquiry)
            .where(
                and_(
                    Inquiry.buyer_id == buyer_id,
                    Inquiry.seller_id == seller_id,
                    Inquiry.created_at >= cutoff,
                )
            )
            .order_by(Inquiry.created_at.desc())
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_for_buyer(self, buyer_id: uuid.UUID) -> list[Inquiry]:
        stmt = (
            select(Inquiry)
            .where(Inquiry.buyer_id == buyer_id)
            .order_by(Inquiry.created_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())
