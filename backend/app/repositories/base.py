"""
Generic async repository.

Repositories are the only layer that touches the SQL session. Services call
into them; controllers never do. Keeping CRUD generic means the per-model
files stay tiny — they only add the queries that aren't a plain primary-key
lookup.
"""
from __future__ import annotations

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """CRUD primitives every model repository inherits."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id_: UUID) -> ModelT | None:
        """Fetch by primary key. Returns `None` if not found."""
        return await self.session.get(self.model, id_)

    async def list(self, *, limit: int = 100, offset: int = 0) -> list[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def add(self, instance: ModelT) -> ModelT:
        """Stage the instance for insert; caller flushes/commits."""
        self.session.add(instance)
        await self.session.flush()       # populate server defaults (id, timestamps)
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: ModelT) -> None:
        await self.session.delete(instance)
        await self.session.flush()

    async def update(self, instance: ModelT, **fields: Any) -> ModelT:
        for k, v in fields.items():
            setattr(instance, k, v)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance
