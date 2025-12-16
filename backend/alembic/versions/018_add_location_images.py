"""Add location_id to images for location photos

Revision ID: 018
Revises: 017
Create Date: 2025-12-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "018"
down_revision: str | None = "017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add location_id column to images table
    op.add_column(
        "images",
        sa.Column("location_id", sa.UUID(), nullable=True),
    )

    # Create foreign key constraint
    op.create_foreign_key(
        "fk_images_location_id",
        "images",
        "locations",
        ["location_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Create index for efficient queries by location
    op.create_index(
        op.f("ix_images_location_id"),
        "images",
        ["location_id"],
        unique=False,
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_images_location_id"), table_name="images")

    # Drop foreign key constraint
    op.drop_constraint("fk_images_location_id", "images", type_="foreignkey")

    # Drop column
    op.drop_column("images", "location_id")
