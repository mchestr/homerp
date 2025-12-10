"""Add hierarchical categories and locations with ltree

Revision ID: 002
Revises: 001
Create Date: 2024-12-09

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy_utils import LtreeType

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable ltree extension for hierarchical path queries
    op.execute("CREATE EXTENSION IF NOT EXISTS ltree")

    # Add hierarchy columns to categories
    op.add_column(
        "categories",
        sa.Column("parent_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "categories",
        sa.Column("path", LtreeType(), nullable=False, server_default=""),
    )
    op.add_column(
        "categories",
        sa.Column("attribute_template", postgresql.JSONB(), nullable=False, server_default="{}"),
    )

    # Add foreign key for category parent
    op.create_foreign_key(
        "fk_categories_parent_id",
        "categories",
        "categories",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add GiST index for ltree path queries on categories
    op.execute("CREATE INDEX ix_categories_path_gist ON categories USING GIST (path)")

    # Add hierarchy columns to locations
    op.add_column(
        "locations",
        sa.Column("parent_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "locations",
        sa.Column("path", LtreeType(), nullable=False, server_default=""),
    )

    # Add foreign key for location parent
    op.create_foreign_key(
        "fk_locations_parent_id",
        "locations",
        "locations",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add GiST index for ltree path queries on locations
    op.execute("CREATE INDEX ix_locations_path_gist ON locations USING GIST (path)")

    # Initialize paths for existing categories (set path = id as string for now)
    # In practice, this will be empty for new deployments
    op.execute("""
        UPDATE categories
        SET path = REPLACE(id::text, '-', '_')::ltree
        WHERE path = ''
    """)

    # Initialize paths for existing locations
    op.execute("""
        UPDATE locations
        SET path = REPLACE(id::text, '-', '_')::ltree
        WHERE path = ''
    """)


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_locations_path_gist")
    op.execute("DROP INDEX IF EXISTS ix_categories_path_gist")

    # Drop foreign keys
    op.drop_constraint("fk_locations_parent_id", "locations", type_="foreignkey")
    op.drop_constraint("fk_categories_parent_id", "categories", type_="foreignkey")

    # Drop columns from locations
    op.drop_column("locations", "path")
    op.drop_column("locations", "parent_id")

    # Drop columns from categories
    op.drop_column("categories", "attribute_template")
    op.drop_column("categories", "path")
    op.drop_column("categories", "parent_id")

    # Note: We don't drop the ltree extension as it might be used by other things
