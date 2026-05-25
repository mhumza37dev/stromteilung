"""
Structured logging setup.

One configuration point — all modules call `structlog.get_logger(__name__)`
and inherit the same processors. JSON renderer in production, pretty
console renderer locally so humans can read.

Request correlation (`request_id`, `user_id`, `path`) is injected by the
`RequestIdMiddleware` via `structlog.contextvars`.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from app.core.config import settings


def configure_logging() -> None:
    """Wire up `logging` and `structlog` to share processors and level."""
    log_level = getattr(logging, settings.log_level)

    # Strip default handlers so we don't double-print after reconfig.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer: Any = (
        structlog.processors.JSONRenderer()
        if settings.log_json
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Quiet down noisy libraries — they still log warnings/errors.
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Drop-in `structlog.get_logger` with our preferred typing."""
    return structlog.get_logger(name)  # type: ignore[return-value]
