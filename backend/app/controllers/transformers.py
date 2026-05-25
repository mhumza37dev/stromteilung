"""
`/transformers/*` routes — lookup by code or by nearest-point.

Read-only for users. Admin endpoints to manage the table land in M6.
"""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import text

from app.core.dependencies import SessionDep
from app.core.exceptions import NotFoundError
from app.repositories.transformer_repo import TransformerRepository
from app.schemas.marketplace import TransformerPublic

router = APIRouter(prefix="/transformers", tags=["transformers"])


@router.get(
    "/by-code/{code}",
    response_model=TransformerPublic,
    summary="Look up a transformer by its printed code (e.g. TR-2847)",
)
async def get_by_code(code: str, session: SessionDep) -> TransformerPublic:
    repo = TransformerRepository(session)
    t = await repo.get_by_code(code)
    if t is None:
        raise NotFoundError("Transformer not found.")
    return TransformerPublic.model_validate(t)


@router.get(
    "/nearest",
    response_model=TransformerPublic,
    summary="Find the transformer closest to a lat/lng (helps onboarding)",
)
async def nearest(
    session: SessionDep,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> TransformerPublic:
    """Returns the single closest transformer to the supplied point — used
    when a buyer types an address and we want to guess the transformer for
    them so they don't have to dig out their electricity bill."""
    row = (
        await session.execute(
            text(
                "SELECT id, code, city "
                "FROM transformers "
                "ORDER BY geo <-> ST_GeographyFromText(:p) "
                "LIMIT 1"
            ),
            {"p": f"SRID=4326;POINT({lng} {lat})"},
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("No transformers seeded yet.")
    return TransformerPublic(id=row.id, code=row.code, city=row.city)
