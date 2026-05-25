"""
Typed application exceptions and a single global FastAPI handler.

Every "expected" failure (not found, unauthorized, validation, …) raises an
`AppError`. The handler converts it into an RFC 7807 problem+json response, so
the frontend sees a predictable shape instead of FastAPI's default mix of 422
and HTTPException bodies.

Unhandled exceptions still fall through to FastAPI's default 500, which Sentry
will capture once wired in.
"""
from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for every business-level failure raised inside the app."""

    status_code: int = 500
    code: str = "internal_error"
    message: str = "Something went wrong."

    def __init__(self, message: str | None = None, *, details: dict[str, Any] | None = None):
        super().__init__(message or self.message)
        if message:
            self.message = message
        self.details = details or {}

    def to_problem(self) -> dict[str, Any]:
        """RFC 7807 shape — frontend reads `code` to localize the error."""
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
        }


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "The requested resource does not exist."


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Authentication required."


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    message = "You don't have permission to do that."


class ValidationFailedError(AppError):
    status_code = 422
    code = "validation_failed"
    message = "Input failed validation."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "That resource already exists or conflicts with another."


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many requests. Try again later."


# --- FastAPI integration ----------------------------------------------------

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Convert any `AppError` subclass into a problem+json response."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem(),
    )
