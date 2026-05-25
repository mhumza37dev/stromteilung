"""
`User`-specific repository — adds the queries we need beyond plain PK lookup.
"""
from __future__ import annotations

from sqlalchemy import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Read/write access to the `users` table."""

    model = User

    async def get_by_email(self, email: str) -> User | None:
        """Case-insensitive email lookup — emails are stored normalized."""
        stmt = select(User).where(User.email == email.lower())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        return (await self.get_by_email(email)) is not None
