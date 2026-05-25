"""
SQLAlchemy declarative base.

A few things worth noting:

1. We pin a consistent **naming convention** on constraints/indexes so Alembic
   produces stable, predictable names (no `_unnamed_idx_1234` noise in diffs).

2. Every model imports `Base` from here; the migrations env imports every
   model module so Alembic sees the full metadata.
"""
from __future__ import annotations

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Naming convention — keep in sync with Alembic env.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Project-wide declarative base for every ORM model."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
