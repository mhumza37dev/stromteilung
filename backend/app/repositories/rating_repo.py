"""Repository for `ratings`."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.models.rating import Rating
from app.repositories.base import BaseRepository


class RatingRepository(BaseRepository[Rating]):
    model = Rating

    async def list_received(self, target_id: uuid.UUID) -> list[Rating]:
        """All ratings *received* by a user — used by the ratings page."""
        stmt = (
            select(Rating)
            .where(Rating.target_id == target_id)
            .order_by(Rating.created_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def aggregate(self, target_id: uuid.UUID) -> tuple[float | None, int]:
        """Return `(avg_stars, count)` for the target user.

        Returned as a tuple so callers can decide how to format / round.
        """
        stmt = select(
            func.avg(Rating.stars).label("avg"),
            func.count(Rating.id).label("count"),
        ).where(Rating.target_id == target_id)
        row = (await self.session.execute(stmt)).one()
        avg = float(row.avg) if row.avg is not None else None
        return avg, int(row.count)
