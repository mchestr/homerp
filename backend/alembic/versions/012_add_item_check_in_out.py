"""Add item check-in/out tracking

Revision ID: 012
Revises: 011
Create Date: 2025-12-12

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012"
down_revision: str | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create item_check_in_outs table
    op.create_table(
        "item_check_in_outs",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("action_type", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
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

    # Create indexes
    op.create_index(
        op.f("ix_item_check_in_outs_user_id"),
        "item_check_in_outs",
        ["user_id"],
    )
    op.create_index(
        op.f("ix_item_check_in_outs_item_id"),
        "item_check_in_outs",
        ["item_id"],
    )
    op.create_index(
        op.f("ix_item_check_in_outs_occurred_at"),
        "item_check_in_outs",
        ["occurred_at"],
    )

    # Enable Row Level Security
    op.execute("ALTER TABLE item_check_in_outs ENABLE ROW LEVEL SECURITY")

    # Create RLS policy
    op.execute("""
        CREATE POLICY item_check_in_outs_tenant_isolation ON item_check_in_outs
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS item_check_in_outs_tenant_isolation ON item_check_in_outs"
    )
    op.drop_index(
        op.f("ix_item_check_in_outs_occurred_at"), table_name="item_check_in_outs"
    )
    op.drop_index(
        op.f("ix_item_check_in_outs_item_id"), table_name="item_check_in_outs"
    )
    op.drop_index(
        op.f("ix_item_check_in_outs_user_id"), table_name="item_check_in_outs"
    )
    op.drop_table("item_check_in_outs")
