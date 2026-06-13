"""users: email unique per role (not globally)

Lets the same email register once per role — one buyer account + one seller
account can share the address. Drops the globally-unique index on `email`,
replaces it with a non-unique secondary index (for lookups) plus a
composite (email, role) unique constraint that enforces the new rule.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-31 14:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old unique-on-email index.
    op.drop_index(op.f('ix_users_email'), table_name='users')
    # Re-add the email index without uniqueness — login still does an
    # `email = ?` scan, so we want it indexed.
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    # Enforce one (email, role) pair globally so we never create dup accounts
    # for the same person in the same role.
    op.create_unique_constraint(
        op.f('uq_users_email_role'),
        'users',
        ['email', 'role'],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('uq_users_email_role'), 'users', type_='unique'
    )
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
