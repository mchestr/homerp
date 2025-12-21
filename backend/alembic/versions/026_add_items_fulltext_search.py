"""Add full-text search to items table

Revision ID: 026
Revises: c72da847f342
Create Date: 2025-12-21

Adds a tsvector column with GIN index for fast full-text search on items.
This enables word-based matching (e.g., "black filament" finds "Filament - Black")
instead of requiring exact substring matches.

The search_vector is updated by a trigger on INSERT/UPDATE that combines:
- name (weight A - highest priority)
- description (weight B - medium priority)
- tags array (weight C - lower priority)
- attributes JSONB (weight D - lowest priority, includes specifications)

Note: We use a trigger instead of a GENERATED ALWAYS column because
to_tsvector('english', ...) is not immutable (depends on dictionary config).
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "026"
down_revision: str | None = "c72da847f342"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add search_vector column
    op.execute("ALTER TABLE items ADD COLUMN search_vector tsvector")

    # Create trigger function to update search_vector
    op.execute("""
        CREATE OR REPLACE FUNCTION items_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
                setweight(to_tsvector('english', coalesce(NEW.attributes::text, '')), 'D');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger to call the function on INSERT/UPDATE
    op.execute("""
        CREATE TRIGGER items_search_vector_trigger
        BEFORE INSERT OR UPDATE ON items
        FOR EACH ROW EXECUTE FUNCTION items_search_vector_update();
    """)

    # Populate search_vector for existing items
    op.execute("""
        UPDATE items SET search_vector =
            setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C') ||
            setweight(to_tsvector('english', coalesce(attributes::text, '')), 'D');
    """)

    # Create GIN index for fast full-text search
    op.execute("CREATE INDEX ix_items_search_vector ON items USING gin(search_vector)")


def downgrade() -> None:
    # Drop the GIN index
    op.execute("DROP INDEX IF EXISTS ix_items_search_vector")

    # Drop the trigger
    op.execute("DROP TRIGGER IF EXISTS items_search_vector_trigger ON items")

    # Drop the trigger function
    op.execute("DROP FUNCTION IF EXISTS items_search_vector_update()")

    # Drop the search_vector column
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS search_vector")
