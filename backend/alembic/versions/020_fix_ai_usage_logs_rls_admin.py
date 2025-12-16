"""Fix AI usage logs RLS policy to allow admin bypass

Revision ID: 020
Revises: 019
Create Date: 2025-12-15

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "020"
down_revision: str | None = "019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop existing RLS policy
    op.execute("DROP POLICY IF EXISTS ai_usage_logs_tenant_isolation ON ai_usage_logs")

    # Create new RLS policy that allows admin bypass
    # Admins can see all usage logs, regular users can only see their own
    op.execute("""
        CREATE POLICY ai_usage_logs_tenant_isolation ON ai_usage_logs
        FOR ALL
        USING (
            user_id = current_setting('app.current_user_id', true)::uuid
            OR EXISTS (
                SELECT 1 FROM users
                WHERE id = current_setting('app.current_user_id', true)::uuid
                AND is_admin = true
            )
        )
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    # Drop the admin-aware policy
    op.execute("DROP POLICY IF EXISTS ai_usage_logs_tenant_isolation ON ai_usage_logs")

    # Restore original policy without admin bypass
    op.execute("""
        CREATE POLICY ai_usage_logs_tenant_isolation ON ai_usage_logs
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)
