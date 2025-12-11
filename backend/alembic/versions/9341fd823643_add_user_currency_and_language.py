"""add_user_currency_and_language

Revision ID: 9341fd823643
Revises: 008
Create Date: 2025-12-10 21:14:13.020506

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9341fd823643"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
