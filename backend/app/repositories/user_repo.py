"""
`User`-specific repository — adds the queries we need beyond plain PK lookup.

Email is no longer globally unique — the same address can hold one row per
role (one buyer + one seller account). Lookups that touch credentials must
therefore disambiguate by role; only the role-less helpers stay for use in
read paths where we just need to know if anyone holds that email.
"""
from __future__ import annotations

from sqlalchemy import select

from app.models.user import User, UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Read/write access to the `users` table."""

    model = User

    async def get_by_email_role(self, email: str, role: UserRole) -> User | None:
        """Credentials lookup: (email, role) is the new uniqueness boundary."""
        stmt = (
            select(User)
            .where(User.email == email.lower())
            .where(User.role == role)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def email_role_exists(self, email: str, role: UserRole) -> bool:
        """True iff an account already exists for this (email, role) pair."""
        return (await self.get_by_email_role(email, role)) is not None

    async def list_by_email(self, email: str) -> list[User]:
        """All accounts sharing an email — used when login omits a role and we
        need to either disambiguate or 401 cleanly."""
        stmt = select(User).where(User.email == email.lower())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
