"""Add Gridfinity storage planning tables

Revision ID: 016
Revises: 015
Create Date: 2025-12-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: str | None = "015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create gridfinity_units table
    op.create_table(
        "gridfinity_units",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("location_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        # Container dimensions in mm
        sa.Column("container_width_mm", sa.Integer(), nullable=False),
        sa.Column("container_depth_mm", sa.Integer(), nullable=False),
        sa.Column("container_height_mm", sa.Integer(), nullable=False),
        # Calculated grid size (standard Gridfinity unit = 42mm)
        sa.Column("grid_columns", sa.Integer(), nullable=False),
        sa.Column("grid_rows", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_gridfinity_unit_user_name"),
    )
    op.create_index(
        op.f("ix_gridfinity_units_user_id"),
        "gridfinity_units",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gridfinity_units_location_id"),
        "gridfinity_units",
        ["location_id"],
        unique=False,
    )

    # Create gridfinity_placements table
    op.create_table(
        "gridfinity_placements",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("unit_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        # Grid position (0-indexed from top-left)
        sa.Column("grid_x", sa.Integer(), nullable=False),
        sa.Column("grid_y", sa.Integer(), nullable=False),
        # Size in grid units (1x1, 2x1, etc.)
        sa.Column(
            "width_units", sa.Integer(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column(
            "depth_units", sa.Integer(), nullable=False, server_default=sa.text("1")
        ),
        # Optional bin info
        sa.Column("bin_height_units", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
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
            ["unit_id"],
            ["gridfinity_units.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["items.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        # Ensure item only placed once per unit
        sa.UniqueConstraint("unit_id", "item_id", name="uq_placement_unit_item"),
        # Ensure position is valid
        sa.CheckConstraint("grid_x >= 0", name="chk_position_x_positive"),
        sa.CheckConstraint("grid_y >= 0", name="chk_position_y_positive"),
        sa.CheckConstraint("width_units > 0", name="chk_width_positive"),
        sa.CheckConstraint("depth_units > 0", name="chk_depth_positive"),
    )
    op.create_index(
        op.f("ix_gridfinity_placements_user_id"),
        "gridfinity_placements",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gridfinity_placements_unit_id"),
        "gridfinity_placements",
        ["unit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gridfinity_placements_item_id"),
        "gridfinity_placements",
        ["item_id"],
        unique=False,
    )

    # Enable Row Level Security
    op.execute("ALTER TABLE gridfinity_units ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE gridfinity_placements ENABLE ROW LEVEL SECURITY")

    # Create RLS policies for tenant isolation
    op.execute("""
        CREATE POLICY gridfinity_units_tenant_isolation ON gridfinity_units
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)
    op.execute("""
        CREATE POLICY gridfinity_placements_tenant_isolation ON gridfinity_placements
        FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
    """)


def downgrade() -> None:
    # Drop RLS policies
    op.execute(
        "DROP POLICY IF EXISTS gridfinity_placements_tenant_isolation "
        "ON gridfinity_placements"
    )
    op.execute(
        "DROP POLICY IF EXISTS gridfinity_units_tenant_isolation ON gridfinity_units"
    )

    # Disable RLS
    op.execute("ALTER TABLE gridfinity_placements DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE gridfinity_units DISABLE ROW LEVEL SECURITY")

    # Drop placements table
    op.drop_index(
        op.f("ix_gridfinity_placements_item_id"), table_name="gridfinity_placements"
    )
    op.drop_index(
        op.f("ix_gridfinity_placements_unit_id"), table_name="gridfinity_placements"
    )
    op.drop_index(
        op.f("ix_gridfinity_placements_user_id"), table_name="gridfinity_placements"
    )
    op.drop_table("gridfinity_placements")

    # Drop units table
    op.drop_index(
        op.f("ix_gridfinity_units_location_id"), table_name="gridfinity_units"
    )
    op.drop_index(op.f("ix_gridfinity_units_user_id"), table_name="gridfinity_units")
    op.drop_table("gridfinity_units")
