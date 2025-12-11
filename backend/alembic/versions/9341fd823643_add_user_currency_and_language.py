"""add_user_currency_and_language

Revision ID: 9341fd823643
Revises: 008
Create Date: 2025-12-10 21:14:13.020506

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9341fd823643"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "currency", sa.String(length=3), server_default="USD", nullable=False
        ),
    )
    op.add_column(
        "users",
        sa.Column("language", sa.String(length=5), server_default="en", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "language")
    op.drop_column("users", "currency")
