"""Repository for the `transformers` lookup table."""
from __future__ import annotations

from sqlalchemy import select

from app.models.transformer import Transformer
from app.repositories.base import BaseRepository


class TransformerRepository(BaseRepository[Transformer]):
    model = Transformer

    async def get_by_code(self, code: str) -> Transformer | None:
        stmt = select(Transformer).where(Transformer.code == code)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_by_city(self, city: str) -> list[Transformer]:
        stmt = select(Transformer).where(Transformer.city == city)
        return list((await self.session.execute(stmt)).scalars().all())
