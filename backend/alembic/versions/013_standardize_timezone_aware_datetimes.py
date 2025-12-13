"""Standardize all datetime columns to TIMESTAMP WITH TIME ZONE

Revision ID: 013
Revises: 012
Create Date: 2025-12-12

This migration ensures all datetime columns in the database use
TIMESTAMP WITH TIME ZONE for consistent timezone handling.
Existing data is preserved and assumed to be in UTC.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "013"
down_revision: str | None = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Alter users.free_credits_reset_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "users",
        "free_credits_reset_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=True,
        postgresql_using="free_credits_reset_at AT TIME ZONE 'UTC'",
    )

    # Alter credit_packs.created_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "credit_packs",
        "created_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )

    # Alter credit_transactions.created_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "credit_transactions",
        "created_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )

    # Alter feedback.created_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "feedback",
        "created_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )

    # Alter feedback.updated_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "feedback",
        "updated_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )

    # Alter webhook_configs.created_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "webhook_configs",
        "created_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )

    # Alter webhook_configs.updated_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "webhook_configs",
        "updated_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )

    # Alter webhook_executions.executed_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "webhook_executions",
        "executed_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
        postgresql_using="executed_at AT TIME ZONE 'UTC'",
    )

    # Alter webhook_executions.completed_at to TIMESTAMP WITH TIME ZONE
    op.alter_column(
        "webhook_executions",
        "completed_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=True,
        postgresql_using="completed_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    # Revert webhook_executions.completed_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "webhook_executions",
        "completed_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=True,
    )

    # Revert webhook_executions.executed_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "webhook_executions",
        "executed_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert webhook_configs.updated_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "webhook_configs",
        "updated_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert webhook_configs.created_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "webhook_configs",
        "created_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert feedback.updated_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "feedback",
        "updated_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert feedback.created_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "feedback",
        "created_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert credit_transactions.created_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "credit_transactions",
        "created_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert credit_packs.created_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "credit_packs",
        "created_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # Revert users.free_credits_reset_at to TIMESTAMP WITHOUT TIME ZONE
    op.alter_column(
        "users",
        "free_credits_reset_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
