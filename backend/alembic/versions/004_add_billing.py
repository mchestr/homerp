"""Add billing tables and user billing fields

Revision ID: 004
Revises: 003
Create Date: 2024-12-09

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add billing fields to users table
    op.add_column(
        "users",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("credit_balance", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column(
            "free_credits_remaining", sa.Integer(), nullable=False, server_default="5"
        ),
    )
    op.add_column(
        "users",
        sa.Column("free_credits_reset_at", sa.DateTime(), nullable=True),
    )

    # Create credit_packs table
    op.create_table(
        "credit_packs",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("stripe_price_id", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create credit_transactions table
    op.create_table(
        "credit_transactions",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("transaction_type", sa.String(50), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=True),
        sa.Column("credit_pack_id", sa.UUID(), nullable=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("is_refunded", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["credit_pack_id"], ["credit_packs.id"], ondelete="SET NULL"
        ),
    )

    # Create indexes
    op.create_index(
        "ix_credit_transactions_user_id", "credit_transactions", ["user_id"]
    )
    op.create_index(
        "ix_credit_transactions_credit_pack_id",
        "credit_transactions",
        ["credit_pack_id"],
    )
    op.create_index(
        "ix_credit_transactions_created_at", "credit_transactions", ["created_at"]
    )

    # Seed default credit packs
    # Note: stripe_price_id values are placeholders - replace with actual Stripe price IDs
    op.execute("""
        INSERT INTO credit_packs (name, credits, price_cents, stripe_price_id, sort_order)
        VALUES
            ('Starter', 25, 300, 'price_starter_placeholder', 1),
            ('Standard', 100, 1000, 'price_standard_placeholder', 2),
            ('Bulk', 500, 4000, 'price_bulk_placeholder', 3)
    """)

    # Initialize free_credits_reset_at for existing users (set to 1 month from now)
    op.execute("""
        UPDATE users
        SET free_credits_reset_at = created_at + interval '1 month'
        WHERE free_credits_reset_at IS NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_credit_transactions_created_at")
    op.drop_index("ix_credit_transactions_credit_pack_id")
    op.drop_index("ix_credit_transactions_user_id")
    op.drop_table("credit_transactions")
    op.drop_table("credit_packs")
    op.drop_column("users", "free_credits_reset_at")
    op.drop_column("users", "free_credits_remaining")
    op.drop_column("users", "credit_balance")
    op.drop_column("users", "stripe_customer_id")
