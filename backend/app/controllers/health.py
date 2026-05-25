"""
Liveness and readiness probes.

- `/health` — answers as long as the process is up.
- `/ready`  — verifies external dependencies (DB) actually respond. K8s and
              load balancers should poll this before sending traffic.
"""
from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import text

from app.core.dependencies import SessionDep

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe — always 200 while process is up")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/ready",
    summary="Readiness probe — verifies the DB is reachable",
    responses={503: {"description": "A dependency is unavailable."}},
)
async def ready(session: SessionDep) -> dict[str, str]:
    """Run the cheapest possible query against Postgres."""
    from app.core.exceptions import AppError

    try:
        await session.execute(text("SELECT 1"))
    except Exception as e:
        # Convert into our problem+json shape via AppError.
        err = AppError("Database connection failed.")
        err.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        err.code = "dependency_unavailable"
        err.details = {"reason": str(e)[:200]}
        raise err from e

    return {"status": "ready"}
