"""Add credit pricing table for configurable operation costs

Revision ID: 022
Revises: 021
Create Date: 2025-12-16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "022"
down_revision: str | None = "021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create credit_pricing table
    op.create_table(
        "credit_pricing",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column(
            "credits_per_operation",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
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
        op.f("ix_credit_pricing_operation_type"),
        "credit_pricing",
        ["operation_type"],
        unique=True,
    )

    # Insert default pricing for existing operations
    op.execute("""
        INSERT INTO credit_pricing (operation_type, credits_per_operation, display_name, description)
        VALUES
            ('image_classification', 1, 'Image Classification', 'AI-powered image classification to identify and categorize items'),
            ('location_analysis', 1, 'Location Analysis', 'AI analysis of location images to suggest storage organization'),
            ('assistant_query', 1, 'AI Assistant Query', 'Ask the AI assistant questions about your inventory'),
            ('location_suggestion', 1, 'Location Suggestion', 'AI-powered suggestions for where to store items')
    """)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_credit_pricing_operation_type"), table_name="credit_pricing")

    # Drop table
    op.drop_table("credit_pricing")
