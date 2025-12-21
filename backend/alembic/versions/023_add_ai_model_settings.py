"""Add AI model settings table for configurable model parameters

Revision ID: 023
Revises: 022
Create Date: 2025-12-20

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "023"
down_revision: str | None = "022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ai_model_settings table
    op.create_table(
        "ai_model_settings",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column(
            "temperature",
            sa.Numeric(precision=3, scale=2),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column("max_tokens", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
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
        sa.UniqueConstraint("operation_type"),
    )

    # Create index on operation_type for fast lookups
    op.create_index(
        op.f("ix_ai_model_settings_operation_type"),
        "ai_model_settings",
        ["operation_type"],
        unique=True,
    )

    # Insert default settings for existing operations
    # These match the current hardcoded values in ai/service.py
    op.execute(
        """
        INSERT INTO ai_model_settings (
            operation_type, model_name, temperature, max_tokens,
            display_name, description
        )
        VALUES
            (
                'image_classification',
                'gpt-4o',
                1.0,
                1000,
                'Image Classification',
                'AI-powered image classification to identify and categorize items'
            ),
            (
                'location_analysis',
                'gpt-4o',
                1.0,
                2000,
                'Location Analysis',
                'AI analysis of location images to suggest storage organization'
            ),
            (
                'location_suggestion',
                'gpt-4o',
                1.0,
                1000,
                'Location Suggestion',
                'AI-powered suggestions for where to store items'
            ),
            (
                'assistant_query',
                'gpt-4o',
                1.0,
                2000,
                'AI Assistant Query',
                'Ask the AI assistant questions about your inventory'
            )
    """
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(
        op.f("ix_ai_model_settings_operation_type"), table_name="ai_model_settings"
    )
    # Drop table
    op.drop_table("ai_model_settings")
