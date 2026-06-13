"""listings: add deleted_at (soft delete)

Soft-delete column for listings. Distinct from `active` (a reversible pause):
once `deleted_at` is set the listing disappears from the seller dashboard and
buyer search for good, but the row is retained for analytics / audit. NULL
means the listing is live. Partial index keeps the "live listings" filter
cheap.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-03 10:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'listings',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Partial index: every read path filters `deleted_at IS NULL`, so index
    # only the live rows — smaller and exactly matches the query predicate.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_listings_live "
        "ON listings (seller_id) WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_listings_live")
    op.drop_column('listings', 'deleted_at')
