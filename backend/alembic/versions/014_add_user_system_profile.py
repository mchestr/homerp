"""Add user system profile and purge recommendations

Revision ID: 014
Revises: 013
Create Date: 2025-12-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: str | None = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create user_system_profiles table
    op.create_table(
        "user_system_profiles",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False, unique=True),
        # Hobby/interest types - what kind of hobbyist are they?
        sa.Column(
            "hobby_types",
            ARRAY(sa.String(100)),
            nullable=False,
            server_default="{}",
        ),
        # Interest categories - categories user cares about most
        sa.Column(
            "interest_category_ids",
            ARRAY(sa.UUID()),
            nullable=False,
            server_default="{}",
        ),
        # Retention preferences
        sa.Column(
            "retention_months",
            sa.Integer(),
            nullable=False,
            server_default="12",
        ),  # Default: keep unused items for 12 months
        sa.Column(
            "min_quantity_threshold",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),  # Consider purging if quantity exceeds this
        sa.Column(
            "min_value_keep",
            sa.Numeric(10, 2),
            nullable=True,
        ),  # Keep items worth more than this regardless of usage
        # Additional preferences
        sa.Column(
            "profile_description",
            sa.String(1000),
            nullable=True,
        ),  # Free text to help AI understand user context
        sa.Column(
            "purge_aggressiveness",
            sa.String(20),
            nullable=False,
            server_default="'moderate'",
        ),  # 'conservative', 'moderate', 'aggressive'
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

    # Create indexes for user_system_profiles
    op.create_index(
        op.f("ix_user_system_profiles_user_id"),
        "user_system_profiles",
        ["user_id"],
        unique=True,
    )

    # Enable Row Level Security for user_system_profiles
    op.execute("ALTER TABLE user_system_profiles ENABLE ROW LEVEL SECURITY")

    # Create RLS policy for user_system_profiles
    op.execute("""
        CREATE POLICY user_system_profiles_tenant_isolation ON user_system_profiles
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Create purge_recommendations table
    op.create_table(
        "purge_recommendations",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        # AI-generated recommendation
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=False),  # 0.00 to 1.00
        # Additional context from AI
        sa.Column("factors", JSONB, nullable=False, server_default="{}"),
        # Status tracking
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="'pending'",
        ),  # 'pending', 'accepted', 'dismissed', 'expired'
        # User feedback (for ML improvement)
        sa.Column("user_feedback", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "resolved_at",
            sa.DateTime(timezone=True),
            nullable=True,
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

    # Create indexes for purge_recommendations
    op.create_index(
        op.f("ix_purge_recommendations_user_id"),
        "purge_recommendations",
        ["user_id"],
    )
    op.create_index(
        op.f("ix_purge_recommendations_item_id"),
        "purge_recommendations",
        ["item_id"],
    )
    op.create_index(
        op.f("ix_purge_recommendations_status"),
        "purge_recommendations",
        ["status"],
    )
    # Unique constraint: one pending recommendation per item at a time
    op.create_index(
        "ix_purge_recommendations_unique_pending",
        "purge_recommendations",
        ["user_id", "item_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )

    # Enable Row Level Security for purge_recommendations
    op.execute("ALTER TABLE purge_recommendations ENABLE ROW LEVEL SECURITY")

    # Create RLS policy for purge_recommendations
    op.execute("""
        CREATE POLICY purge_recommendations_tenant_isolation ON purge_recommendations
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    # Drop purge_recommendations
    op.execute(
        "DROP POLICY IF EXISTS purge_recommendations_tenant_isolation "
        "ON purge_recommendations"
    )
    op.drop_index(
        "ix_purge_recommendations_unique_pending",
        table_name="purge_recommendations",
    )
    op.drop_index(
        op.f("ix_purge_recommendations_status"),
        table_name="purge_recommendations",
    )
    op.drop_index(
        op.f("ix_purge_recommendations_item_id"),
        table_name="purge_recommendations",
    )
    op.drop_index(
        op.f("ix_purge_recommendations_user_id"),
        table_name="purge_recommendations",
    )
    op.drop_table("purge_recommendations")

    # Drop user_system_profiles
    op.execute(
        "DROP POLICY IF EXISTS user_system_profiles_tenant_isolation "
        "ON user_system_profiles"
    )
    op.drop_index(
        op.f("ix_user_system_profiles_user_id"),
        table_name="user_system_profiles",
    )
    op.drop_table("user_system_profiles")
