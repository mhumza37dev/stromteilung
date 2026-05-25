"""
Repository for issued refresh tokens.

Lookup is by `user_id` then constant-time-compared against the stored hash —
we never query by token plaintext.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update

from app.models.refresh_token import RefreshToken
from app.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    """Read/write access to the `refresh_tokens` table."""

    model = RefreshToken

    async def list_active_for_user(self, user_id: UUID) -> list[RefreshToken]:
        """All non-revoked, non-expired tokens belonging to a given user."""
        now = datetime.now(tz=timezone.utc)
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
            .where(RefreshToken.expires_at > now)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def revoke(self, token: RefreshToken) -> None:
        """Mark a single token revoked."""
        token.revoked_at = datetime.now(tz=timezone.utc)
        await self.session.flush()

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        """Revoke every active token for a user (e.g. "log out everywhere")."""
        now = datetime.now(tz=timezone.utc)
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        result = await self.session.execute(stmt)
        return result.rowcount or 0
