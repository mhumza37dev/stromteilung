"""Repository for `profiles` — 1:1 with users, keyed by `user_id`."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.profile import Profile
from app.repositories.base import BaseRepository


class ProfileRepository(BaseRepository[Profile]):
    model = Profile

    async def get_by_user_id(self, user_id: uuid.UUID) -> Profile | None:
        """Profile FK == PK; use `session.get` directly."""
        return await self.session.get(Profile, user_id)
