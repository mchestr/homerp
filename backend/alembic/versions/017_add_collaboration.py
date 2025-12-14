"""Add multi-user collaboration tables

Revision ID: 017
Revises: 016
Create Date: 2025-12-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: str | None = "016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create inventory_collaborators table
    # This table manages who has access to whose inventory
    op.create_table(
        "inventory_collaborators",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # The owner of the inventory being shared
        sa.Column("owner_id", sa.UUID(), nullable=False),
        # The user who has been granted access (NULL until invitation accepted)
        sa.Column("collaborator_id", sa.UUID(), nullable=True),
        # Email used for invitation (for pending invitations)
        sa.Column("invited_email", sa.String(length=255), nullable=False),
        # Role: 'viewer' (read-only) or 'editor' (can create/edit items)
        sa.Column(
            "role", sa.String(length=20), nullable=False, server_default="viewer"
        ),
        # Status: 'pending', 'accepted', 'declined'
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="pending"
        ),
        # Invitation token for accepting
        sa.Column("invitation_token", sa.String(length=64), nullable=True, unique=True),
        # Token expiration (default 7 days from creation)
        sa.Column("invitation_expires_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["collaborator_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        # Owner can only invite same email once
        sa.UniqueConstraint(
            "owner_id", "invited_email", name="uq_collaborator_owner_email"
        ),
        # Check that role is valid
        sa.CheckConstraint(
            "role IN ('viewer', 'editor')", name="chk_collaborator_role"
        ),
        # Check that status is valid
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="chk_collaborator_status",
        ),
    )
    op.create_index(
        op.f("ix_inventory_collaborators_owner_id"),
        "inventory_collaborators",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inventory_collaborators_collaborator_id"),
        "inventory_collaborators",
        ["collaborator_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inventory_collaborators_invited_email"),
        "inventory_collaborators",
        ["invited_email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inventory_collaborators_invitation_token"),
        "inventory_collaborators",
        ["invitation_token"],
        unique=True,
    )
    # Composite index for filtering by owner and status
    op.create_index(
        op.f("ix_inventory_collaborators_owner_status"),
        "inventory_collaborators",
        ["owner_id", "status"],
        unique=False,
    )

    # Enable Row Level Security
    op.execute("ALTER TABLE inventory_collaborators ENABLE ROW LEVEL SECURITY")

    # RLS policy: owners can see/manage their own collaborator records
    op.execute("""
        CREATE POLICY inventory_collaborators_owner_policy ON inventory_collaborators
        FOR ALL
        USING (owner_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # RLS policy: collaborators can see records where they are the invited collaborator
    op.execute("""
        CREATE POLICY inventory_collaborators_collaborator_policy ON inventory_collaborators
        FOR SELECT
        USING (collaborator_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # RLS policy: users can see pending invitations sent to their email
    # (for accepting invitations before collaborator_id is set)
    op.execute("""
        CREATE POLICY inventory_collaborators_pending_invitation_policy ON inventory_collaborators
        FOR SELECT
        USING (
            status = 'pending'
            AND invited_email = (
                SELECT email FROM users
                WHERE id = current_setting('app.current_user_id', true)::uuid
            )
        )
    """)

    # RLS policy: collaborators can update their own invitation status (accept/decline)
    op.execute("""
        CREATE POLICY inventory_collaborators_accept_policy ON inventory_collaborators
        FOR UPDATE
        USING (
            invited_email = (
                SELECT email FROM users
                WHERE id = current_setting('app.current_user_id', true)::uuid
            )
        )
        WITH CHECK (
            invited_email = (
                SELECT email FROM users
                WHERE id = current_setting('app.current_user_id', true)::uuid
            )
        )
    """)

    # Add trigger for updated_at
    op.execute("""
        CREATE TRIGGER update_inventory_collaborators_updated_at
        BEFORE UPDATE ON inventory_collaborators
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    """)


def downgrade() -> None:
    # Drop trigger
    op.execute(
        "DROP TRIGGER IF EXISTS update_inventory_collaborators_updated_at ON inventory_collaborators"
    )

    # Drop RLS policies
    op.execute(
        "DROP POLICY IF EXISTS inventory_collaborators_accept_policy ON inventory_collaborators"
    )
    op.execute(
        "DROP POLICY IF EXISTS inventory_collaborators_pending_invitation_policy ON inventory_collaborators"
    )
    op.execute(
        "DROP POLICY IF EXISTS inventory_collaborators_collaborator_policy ON inventory_collaborators"
    )
    op.execute(
        "DROP POLICY IF EXISTS inventory_collaborators_owner_policy ON inventory_collaborators"
    )

    # Disable RLS
    op.execute("ALTER TABLE inventory_collaborators DISABLE ROW LEVEL SECURITY")

    # Drop indexes
    op.drop_index(
        op.f("ix_inventory_collaborators_owner_status"),
        table_name="inventory_collaborators",
    )
    op.drop_index(
        op.f("ix_inventory_collaborators_invitation_token"),
        table_name="inventory_collaborators",
    )
    op.drop_index(
        op.f("ix_inventory_collaborators_invited_email"),
        table_name="inventory_collaborators",
    )
    op.drop_index(
        op.f("ix_inventory_collaborators_collaborator_id"),
        table_name="inventory_collaborators",
    )
    op.drop_index(
        op.f("ix_inventory_collaborators_owner_id"),
        table_name="inventory_collaborators",
    )

    # Drop table
    op.drop_table("inventory_collaborators")
