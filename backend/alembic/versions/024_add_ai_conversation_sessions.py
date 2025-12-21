"""Add AI conversation sessions and messages tables for persistent chat history

Revision ID: 024
Revises: 023
Create Date: 2025-12-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "024"
down_revision: str | None = "023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ai_conversation_sessions table
    op.create_table(
        "ai_conversation_sessions",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_ai_conversation_sessions_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for sessions
    op.create_index(
        op.f("ix_ai_conversation_sessions_user_id"),
        "ai_conversation_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_conversation_sessions_updated_at"),
        "ai_conversation_sessions",
        ["updated_at"],
        unique=False,
    )
    # Partial index to optimize RLS policy subquery for active sessions
    op.create_index(
        "ix_ai_sessions_user_id_active",
        "ai_conversation_sessions",
        ["user_id", "id"],
        unique=False,
        postgresql_where=sa.text("is_active = true"),
    )

    # Create ai_conversation_messages table
    op.create_table(
        "ai_conversation_messages",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.String(length=50000), nullable=True),
        sa.Column("tool_calls", JSONB(), nullable=True),
        sa.Column("tool_call_id", sa.String(length=100), nullable=True),
        sa.Column("tool_name", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["ai_conversation_sessions.id"],
            name="fk_ai_conversation_messages_session_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        # Check that role is valid
        sa.CheckConstraint(
            "role IN ('user', 'assistant', 'tool', 'system')",
            name="chk_ai_message_role",
        ),
    )

    # Create indexes for messages
    op.create_index(
        op.f("ix_ai_conversation_messages_session_id"),
        "ai_conversation_messages",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_conversation_messages_created_at"),
        "ai_conversation_messages",
        ["created_at"],
        unique=False,
    )

    # Enable Row Level Security for sessions
    op.execute("ALTER TABLE ai_conversation_sessions ENABLE ROW LEVEL SECURITY")

    # RLS policy for sessions (direct user_id check)
    op.execute("""
        CREATE POLICY ai_conversation_sessions_tenant_isolation ON ai_conversation_sessions
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Enable Row Level Security for messages
    op.execute("ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY")

    # RLS policy for messages (via session join)
    op.execute("""
        CREATE POLICY ai_conversation_messages_tenant_isolation ON ai_conversation_messages
        FOR ALL
        USING (session_id IN (
            SELECT id FROM ai_conversation_sessions
            WHERE user_id = current_setting('app.current_user_id', true)::uuid
        ))
        WITH CHECK (session_id IN (
            SELECT id FROM ai_conversation_sessions
            WHERE user_id = current_setting('app.current_user_id', true)::uuid
        ))
    """)


def downgrade() -> None:
    # Drop RLS policies
    op.execute(
        "DROP POLICY IF EXISTS ai_conversation_messages_tenant_isolation "
        "ON ai_conversation_messages"
    )
    op.execute(
        "DROP POLICY IF EXISTS ai_conversation_sessions_tenant_isolation "
        "ON ai_conversation_sessions"
    )

    # Disable RLS
    op.execute("ALTER TABLE ai_conversation_messages DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE ai_conversation_sessions DISABLE ROW LEVEL SECURITY")

    # Drop indexes for messages
    op.drop_index(
        op.f("ix_ai_conversation_messages_created_at"),
        table_name="ai_conversation_messages",
    )
    op.drop_index(
        op.f("ix_ai_conversation_messages_session_id"),
        table_name="ai_conversation_messages",
    )

    # Drop messages table
    op.drop_table("ai_conversation_messages")

    # Drop indexes for sessions
    op.drop_index(
        "ix_ai_sessions_user_id_active",
        table_name="ai_conversation_sessions",
    )
    op.drop_index(
        op.f("ix_ai_conversation_sessions_updated_at"),
        table_name="ai_conversation_sessions",
    )
    op.drop_index(
        op.f("ix_ai_conversation_sessions_user_id"),
        table_name="ai_conversation_sessions",
    )

    # Drop sessions table
    op.drop_table("ai_conversation_sessions")
