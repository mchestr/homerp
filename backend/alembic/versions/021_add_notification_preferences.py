"""Add notification preferences and alert history

Revision ID: 021
Revises: 020
Create Date: 2025-12-16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "021"
down_revision: str | None = "020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create notification_preferences table
    op.create_table(
        "notification_preferences",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        # Master switch for email notifications
        sa.Column(
            "email_notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        # Low stock email preferences
        sa.Column(
            "low_stock_email_enabled",
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create unique index on user_id
    op.create_index(
        op.f("ix_notification_preferences_user_id"),
        "notification_preferences",
        ["user_id"],
        unique=True,
    )

    # Enable Row Level Security for notification_preferences
    op.execute("ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY")

    # Create RLS policy for notification_preferences
    op.execute("""
        CREATE POLICY notification_preferences_tenant_isolation ON notification_preferences
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Create alert_history table
    op.create_table(
        "alert_history",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        # Alert type (low_stock for now, extensible)
        sa.Column("alert_type", sa.String(50), nullable=False),
        # Channel (email for now, extensible)
        sa.Column("channel", sa.String(50), nullable=False),
        # Recipient details
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        # Status tracking
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="'pending'",
        ),  # 'pending', 'sent', 'failed'
        sa.Column("error_message", sa.String(1000), nullable=True),
        # Snapshot of item state at alert time
        sa.Column("item_quantity_at_alert", sa.Integer(), nullable=False),
        sa.Column("item_min_quantity", sa.Integer(), nullable=False),
        # Timestamps
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["items.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for alert_history
    op.create_index(
        op.f("ix_alert_history_user_id"),
        "alert_history",
        ["user_id"],
    )
    op.create_index(
        op.f("ix_alert_history_item_id"),
        "alert_history",
        ["item_id"],
    )
    op.create_index(
        op.f("ix_alert_history_sent_at"),
        "alert_history",
        ["sent_at"],
    )
    # Composite index for deduplication queries
    op.create_index(
        "ix_alert_history_deduplication",
        "alert_history",
        ["item_id", "alert_type", "sent_at"],
    )

    # Enable Row Level Security for alert_history
    op.execute("ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY")

    # Create RLS policy for alert_history
    op.execute("""
        CREATE POLICY alert_history_tenant_isolation ON alert_history
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    # Drop alert_history
    op.execute("DROP POLICY IF EXISTS alert_history_tenant_isolation ON alert_history")
    op.drop_index("ix_alert_history_deduplication", table_name="alert_history")
    op.drop_index(op.f("ix_alert_history_sent_at"), table_name="alert_history")
    op.drop_index(op.f("ix_alert_history_item_id"), table_name="alert_history")
    op.drop_index(op.f("ix_alert_history_user_id"), table_name="alert_history")
    op.drop_table("alert_history")

    # Drop notification_preferences
    op.execute(
        "DROP POLICY IF EXISTS notification_preferences_tenant_isolation "
        "ON notification_preferences"
    )
    op.drop_index(
        op.f("ix_notification_preferences_user_id"),
        table_name="notification_preferences",
    )
    op.drop_table("notification_preferences")
