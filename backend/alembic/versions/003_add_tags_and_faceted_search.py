"""Add tags to items for faceted search

Revision ID: 003
Revises: 002
Create Date: 2024-12-09

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add tags column to items as a PostgreSQL array
    op.add_column(
        "items",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String(100)),
            nullable=False,
            server_default="{}",
        ),
    )

    # Create GIN index for efficient tag searches
    op.execute("CREATE INDEX ix_items_tags_gin ON items USING GIN (tags)")

    # Create GIN index for JSONB attributes for faceted search
    op.execute("CREATE INDEX ix_items_attributes_gin ON items USING GIN (attributes)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_items_attributes_gin")
    op.execute("DROP INDEX IF EXISTS ix_items_tags_gin")
    op.drop_column("items", "tags")
