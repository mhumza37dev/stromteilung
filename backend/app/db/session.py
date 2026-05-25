"""
Async SQLAlchemy engine + session factory.

We expose:

- `engine`         — the singleton AsyncEngine. Pooled connections live here.
- `SessionLocal`   — an `async_sessionmaker` producing `AsyncSession` instances.
- `get_session()`  — FastAPI dependency yielding one session per request.

SSL: Aiven (and most managed Postgres) requires TLS. We pass `ssl="require"`
to asyncpg via `connect_args`, mapping the libpq vocabulary the user knows
(`disable | prefer | require | verify-ca | verify-full`) onto asyncpg's API.
"""
from __future__ import annotations

import ssl as ssl_lib
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


def _ssl_arg() -> bool | str | ssl_lib.SSLContext:
    """Translate `DATABASE_SSL` into something asyncpg understands."""
    mode = settings.database_ssl
    if mode == "disable":
        return False
    if mode in {"prefer", "require"}:
        # Encrypt the channel but don't verify the certificate chain — fine for
        # managed providers using their own CA in dev. Tighten in prod.
        ctx = ssl_lib.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl_lib.CERT_NONE
        return ctx
    # verify-ca / verify-full — strict; expects a trusted CA bundle locally.
    return ssl_lib.create_default_context()


engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_pre_ping=True,                 # detects stale conns after idle timeouts
    connect_args={"ssl": _ssl_arg()},
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,             # objects remain usable after commit
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """
    FastAPI dependency: yields a session, commits on success, rolls back on
    error, always closes. Controllers grab this via `Depends(get_session)`.
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
