"""
Alembic runtime environment.

We override Alembic's default sync-only flow with async-aware logic so we can
re-use the same engine config (and SSL handling) the app itself uses.
"""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection

# Importing the models module registers every model on Base.metadata.
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401 — side-effect import; do not remove.

# Alembic Config object — gives access to the .ini file.
config = context.config

# Inject the live SQLAlchemy URL so the .ini doesn't need to hard-code secrets.
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Tables Alembic must NOT touch in autogenerate diffs. PostGIS installs
# `spatial_ref_sys` (and a `geometry_columns` / `geography_columns` view) —
# they belong to the extension, not our app.
_POSTGIS_OWNED = {"spatial_ref_sys", "geometry_columns", "geography_columns"}


def _include_object(obj, name, type_, reflected, compare_to):
    """Filter PostGIS-owned tables out of autogenerate."""
    if type_ == "table" and name in _POSTGIS_OWNED:
        return False
    return True


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to the DB (CI / review use)."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Async migrations using the app's existing engine + connection pool."""
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
