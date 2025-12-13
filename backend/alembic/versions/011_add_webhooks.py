"""Add webhooks tables

Revision ID: 011
Revises: 010
Create Date: 2025-12-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: str | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create webhook_configs table
    op.create_table(
        "webhook_configs",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column(
            "http_method",
            sa.String(length=10),
            nullable=False,
            server_default="POST",
        ),
        sa.Column("headers", JSONB(), server_default="{}", nullable=False),
        sa.Column("body_template", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("retry_count", sa.Integer(), server_default="3", nullable=False),
        sa.Column("timeout_seconds", sa.Integer(), server_default="30", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_type"),
    )
    op.create_index(
        op.f("ix_webhook_configs_event_type"),
        "webhook_configs",
        ["event_type"],
        unique=True,
    )

    # Create webhook_executions table
    op.create_table(
        "webhook_executions",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("webhook_config_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("event_payload", JSONB(), nullable=False),
        sa.Column("request_url", sa.String(length=2048), nullable=False),
        sa.Column("request_headers", JSONB(), nullable=False),
        sa.Column("request_body", sa.Text(), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="pending"
        ),
        sa.Column("attempt_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "executed_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["webhook_config_id"],
            ["webhook_configs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_webhook_executions_webhook_config_id"),
        "webhook_executions",
        ["webhook_config_id"],
    )
    op.create_index(
        op.f("ix_webhook_executions_event_type"),
        "webhook_executions",
        ["event_type"],
    )
    op.create_index(
        op.f("ix_webhook_executions_status"),
        "webhook_executions",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_webhook_executions_status"), table_name="webhook_executions")
    op.drop_index(
        op.f("ix_webhook_executions_event_type"), table_name="webhook_executions"
    )
    op.drop_index(
        op.f("ix_webhook_executions_webhook_config_id"), table_name="webhook_executions"
    )
    op.drop_table("webhook_executions")
    op.drop_index(op.f("ix_webhook_configs_event_type"), table_name="webhook_configs")
    op.drop_table("webhook_configs")
