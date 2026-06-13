"""listings: add geo column (per-listing PostGIS POINT)

Stores the precise lat/lng the seller pinned when creating the listing.
Nullable — old rows continue to inherit from the seller's profile geo via
the nearby search's fallback. GeoAlchemy2 auto-creates the GiST index.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-31 13:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'listings',
        sa.Column(
            'geo',
            geoalchemy2.types.Geography(
                geometry_type='POINT',
                srid=4326,
                dimension=2,
                from_text='ST_GeogFromText',
                name='geography',
            ),
            nullable=True,
        ),
    )
    # GiST index for fast `ST_DWithin` queries — same shape as profiles/transformers.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_listings_geo "
        "ON listings USING GIST (geo)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_listings_geo")
    op.drop_column('listings', 'geo')
