"""convert_specifications_dict_to_array

Converts specifications from dict format {key: value} to array format
[{key: key, value: value}] to preserve ordering in PostgreSQL JSONB.

Revision ID: 548f62a25d96
Revises: 023
Create Date: 2025-12-20 21:59:43.940387

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "548f62a25d96"
down_revision: str | None = "023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Convert specifications from dict to array format.

    This migration converts specifications stored in attributes.specifications
    from dict format: {"color": "red", "size": "large"}
    to array format: [{"key": "color", "value": "red"}, {"key": "size", "value": "large"}]

    The array format preserves ordering, which is important for user-defined
    specification order (drag and drop reordering).
    """
    # SQL to convert specifications from dict to array format
    # Uses jsonb_build_object and jsonb_agg to transform the structure
    #
    # Defensive checks:
    # - attributes IS NOT NULL: Ensures we don't process NULL attributes
    # - attributes ? 'specifications': Ensures specifications key exists
    # - jsonb_typeof(...) = 'object': Only converts dicts, skips if already array
    # - COALESCE(..., '[]'): Handles empty objects gracefully
    op.execute(
        """
        UPDATE items
        SET attributes = jsonb_set(
            attributes,
            '{specifications}',
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object('key', kv.key, 'value', kv.value)
                    )
                    FROM jsonb_each(attributes->'specifications') AS kv(key, value)
                ),
                '[]'::jsonb
            )
        )
        WHERE attributes IS NOT NULL
          AND attributes ? 'specifications'
          AND jsonb_typeof(attributes->'specifications') = 'object'
        """
    )


def downgrade() -> None:
    """Convert specifications from array back to dict format.

    This reverses the upgrade by converting:
    [{"key": "color", "value": "red"}, {"key": "size", "value": "large"}]
    back to: {"color": "red", "size": "large"}

    Note: This may lose ordering information since JSONB objects don't
    preserve key order.
    """
    op.execute(
        """
        UPDATE items
        SET attributes = jsonb_set(
            attributes,
            '{specifications}',
            COALESCE(
                (
                    SELECT jsonb_object_agg(elem->>'key', elem->'value')
                    FROM jsonb_array_elements(attributes->'specifications') AS elem
                    WHERE elem ? 'key' AND elem ? 'value'
                ),
                '{}'::jsonb
            )
        )
        WHERE attributes IS NOT NULL
          AND attributes ? 'specifications'
          AND jsonb_typeof(attributes->'specifications') = 'array'
        """
    )
