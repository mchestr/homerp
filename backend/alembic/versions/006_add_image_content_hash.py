"""Add content_hash field to images table for duplicate detection

Revision ID: 006
Revises: 005
Create Date: 2024-12-10

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "images",
        sa.Column("content_hash", sa.String(64), nullable=True),
    )
    # Create index for fast duplicate lookups (user_id + content_hash)
    op.create_index(
        "ix_images_user_content_hash",
        "images",
        ["user_id", "content_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_images_user_content_hash", table_name="images")
    op.drop_column("images", "content_hash")
