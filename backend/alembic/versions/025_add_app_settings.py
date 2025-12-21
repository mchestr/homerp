"""Add app_settings table for configurable billing settings

Revision ID: 025
Revises: 024
Create Date: 2025-12-20

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "025"
down_revision: str | None = "024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create app_settings table for configurable application settings
    op.create_table(
        "app_settings",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("setting_key", sa.String(length=50), nullable=False),
        sa.Column("value_int", sa.Integer(), nullable=True),
        sa.Column("value_string", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("setting_key"),
    )

    # Create index on setting_key for fast lookups
    op.create_index(
        op.f("ix_app_settings_setting_key"),
        "app_settings",
        ["setting_key"],
        unique=True,
    )

    # Insert default signup credits setting
    op.execute(
        """
        INSERT INTO app_settings (
            setting_key, value_int, display_name, description
        )
        VALUES
            (
                'signup_credits',
                5,
                'Signup Credits',
                'Number of free credits granted to new users upon registration'
            )
    """
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_app_settings_setting_key"), table_name="app_settings")
    # Drop table
    op.drop_table("app_settings")
