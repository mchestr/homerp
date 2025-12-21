"""merge_specifications_and_settings_branches

Revision ID: c72da847f342
Revises: 025, 548f62a25d96
Create Date: 2025-12-21 00:21:06.067038

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "c72da847f342"
down_revision: str | None = ("025", "548f62a25d96")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
