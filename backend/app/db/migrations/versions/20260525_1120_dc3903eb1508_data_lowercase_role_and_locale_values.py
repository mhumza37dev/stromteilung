"""data: lowercase role and locale values

Revision ID: dc3903eb1508
Revises: 7be0c5635862
Create Date: 2026-05-25 11:20:27.249364+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc3903eb1508'
down_revision: Union[str, None] = '7be0c5635862'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Lowercase existing `role` and `locale` values.

    Previously the SQLAlchemy Enum column stored the enum *name* (e.g.
    `SELLER`). The model now uses `values_callable` to persist the .value
    (`seller`) instead, matching JSON responses and seed SQL. This UPDATE
    aligns existing rows.
    """
    op.execute("UPDATE users SET role   = lower(role)")
    op.execute("UPDATE users SET locale = lower(locale)")


def downgrade() -> None:
    """Restore uppercase names if rolling back the model change."""
    op.execute("UPDATE users SET role   = upper(role)")
    op.execute("UPDATE users SET locale = upper(locale)")
