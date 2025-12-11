"""add_thumbnail_path_to_images

Revision ID: 008
Revises: 7790740d439c
Create Date: 2025-12-10

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "7790740d439c"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "images", sa.Column("thumbnail_path", sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("images", "thumbnail_path")
