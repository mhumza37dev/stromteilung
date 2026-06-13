"""listings: add per-listing address_text + transformer_id

Adds optional overrides so a seller can pin individual listings to a
specific building/transformer instead of inheriting from their profile.
Both columns are nullable — when NULL, the UI falls back to the seller's
profile values.

Revision ID: a1b2c3d4e5f6
Revises: dc3903eb1508
Create Date: 2026-05-31 12:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'dc3903eb1508'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'listings',
        sa.Column('address_text', sa.String(length=300), nullable=True),
    )
    op.add_column(
        'listings',
        sa.Column('transformer_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f('fk_listings_transformer_id_transformers'),
        'listings',
        'transformers',
        ['transformer_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_listings_transformer_id'),
        'listings',
        ['transformer_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_listings_transformer_id'), table_name='listings')
    op.drop_constraint(
        op.f('fk_listings_transformer_id_transformers'),
        'listings',
        type_='foreignkey',
    )
    op.drop_column('listings', 'transformer_id')
    op.drop_column('listings', 'address_text')
