"""Initial schema with RLS

Revision ID: 001
Revises:
Create Date: 2024-12-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("oauth_provider", sa.String(50), nullable=False),
        sa.Column("oauth_id", sa.String(255), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("oauth_provider", "oauth_id", name="uq_user_oauth"),
    )

    # Create categories table
    op.create_table(
        "categories",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_category_user_name"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])

    # Create locations table
    op.create_table(
        "locations",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("location_type", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_location_user_name"),
    )
    op.create_index("ix_locations_user_id", "locations", ["user_id"])

    # Create items table
    op.create_table(
        "items",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("category_id", sa.UUID(), nullable=True),
        sa.Column("location_id", sa.UUID(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantity_unit", sa.String(50), nullable=False, server_default="pcs"),
        sa.Column("min_quantity", sa.Integer(), nullable=True),
        sa.Column(
            "attributes", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "ai_classification", postgresql.JSONB(), nullable=False, server_default="{}"
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_user_id", "items", ["user_id"])
    op.create_index("ix_items_category_id", "items", ["category_id"])
    op.create_index("ix_items_location_id", "items", ["location_id"])
    op.create_index("ix_items_name", "items", ["user_id", "name"])
    op.create_index(
        "ix_items_attributes", "items", ["attributes"], postgresql_using="gin"
    )

    # Create images table
    op.create_table(
        "images",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("item_id", sa.UUID(), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column(
            "storage_type", sa.String(20), nullable=False, server_default="local"
        ),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ai_processed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ai_result", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_images_item_id", "images", ["item_id"])
    op.create_index("ix_images_user_id", "images", ["user_id"])

    # Enable Row Level Security on tenant tables
    op.execute("ALTER TABLE categories ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE locations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE items ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE images ENABLE ROW LEVEL SECURITY")

    # Create RLS policies
    # Categories policy
    op.execute("""
        CREATE POLICY categories_tenant_isolation ON categories
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Locations policy
    op.execute("""
        CREATE POLICY locations_tenant_isolation ON locations
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Items policy
    op.execute("""
        CREATE POLICY items_tenant_isolation ON items
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Images policy
    op.execute("""
        CREATE POLICY images_tenant_isolation ON images
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)

    # Create function to auto-update updated_at timestamp
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql'
    """)

    # Create triggers for updated_at
    op.execute("""
        CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)

    op.execute("""
        CREATE TRIGGER update_items_updated_at
        BEFORE UPDATE ON items
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_items_updated_at ON items")
    op.execute("DROP TRIGGER IF EXISTS update_users_updated_at ON users")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS images_tenant_isolation ON images")
    op.execute("DROP POLICY IF EXISTS items_tenant_isolation ON items")
    op.execute("DROP POLICY IF EXISTS locations_tenant_isolation ON locations")
    op.execute("DROP POLICY IF EXISTS categories_tenant_isolation ON categories")

    # Disable RLS
    op.execute("ALTER TABLE images DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE items DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE locations DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE categories DISABLE ROW LEVEL SECURITY")

    # Drop tables in reverse order
    op.drop_table("images")
    op.drop_table("items")
    op.drop_table("locations")
    op.drop_table("categories")
    op.drop_table("users")
