"""Add AI usage logs table for tracking token usage

Revision ID: 019
Revises: 018
Create Date: 2025-12-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "019"
down_revision: str | None = "018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ai_usage_logs table
    op.create_table(
        "ai_usage_logs",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("credit_transaction_id", sa.UUID(), nullable=True),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Numeric(10, 6), nullable=False),
        sa.Column("request_metadata", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_ai_usage_logs_user_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["credit_transaction_id"],
            ["credit_transactions.id"],
            name="fk_ai_usage_logs_credit_transaction_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index(
        op.f("ix_ai_usage_logs_user_id"),
        "ai_usage_logs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_usage_logs_credit_transaction_id"),
        "ai_usage_logs",
        ["credit_transaction_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_usage_logs_operation_type"),
        "ai_usage_logs",
        ["operation_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_usage_logs_created_at"),
        "ai_usage_logs",
        ["created_at"],
        unique=False,
    )

    # Enable Row Level Security
    op.execute("ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY")

    # Create RLS policy for tenant isolation
    op.execute("""
        CREATE POLICY ai_usage_logs_tenant_isolation ON ai_usage_logs
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    # Drop RLS policy
    op.execute("DROP POLICY IF EXISTS ai_usage_logs_tenant_isolation ON ai_usage_logs")

    # Disable RLS
    op.execute("ALTER TABLE ai_usage_logs DISABLE ROW LEVEL SECURITY")

    # Drop indexes
    op.drop_index(op.f("ix_ai_usage_logs_created_at"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_operation_type"), table_name="ai_usage_logs")
    op.drop_index(
        op.f("ix_ai_usage_logs_credit_transaction_id"), table_name="ai_usage_logs"
    )
    op.drop_index(op.f("ix_ai_usage_logs_user_id"), table_name="ai_usage_logs")

    # Drop table
    op.drop_table("ai_usage_logs")
