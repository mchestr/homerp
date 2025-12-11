"""add_price_to_items

Revision ID: 7790740d439c
Revises: 006
Create Date: 2025-12-10 21:01:28.111071

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7790740d439c"
down_revision: str | None = "006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "items", sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("items", "price")
