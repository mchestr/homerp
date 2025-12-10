from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.categories.models import Category
from src.items.models import Item
from src.items.schemas import Facet, FacetValue, ItemCreate, ItemUpdate
from src.locations.models import Location


class ItemRepository:
    """Repository for item database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    def _base_query(self):
        """Base query with eager loading."""
        return (
            select(Item)
            .where(Item.user_id == self.user_id)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.images),
            )
        )

    async def _get_category_descendant_ids(self, category_id: UUID) -> list[UUID]:
        """Get IDs of a category and all its descendants."""
        # Get the category's path
        result = await self.session.execute(
            select(Category).where(
                Category.id == category_id,
                Category.user_id == self.user_id,
            )
        )
        category = result.scalar_one_or_none()
        if not category:
            return [category_id]

        # Get all descendant IDs using ltree
        if category.path:
            result = await self.session.execute(
                select(Category.id).where(
                    Category.user_id == self.user_id,
                    text("path <@ :parent_path").bindparams(parent_path=str(category.path)),
                )
            )
            return list(result.scalars().all())
        return [category_id]

    async def _get_location_descendant_ids(self, location_id: UUID) -> list[UUID]:
        """Get IDs of a location and all its descendants."""
        # Get the location's path
        result = await self.session.execute(
            select(Location).where(
                Location.id == location_id,
                Location.user_id == self.user_id,
            )
        )
        location = result.scalar_one_or_none()
        if not location:
            return [location_id]

        # Get all descendant IDs using ltree
        if location.path:
            result = await self.session.execute(
                select(Location.id).where(
                    Location.user_id == self.user_id,
                    text("path <@ :parent_path").bindparams(parent_path=str(location.path)),
                )
            )
            return list(result.scalars().all())
        return [location_id]

    async def get_all(
        self,
        *,
        category_id: UUID | None = None,
        include_subcategories: bool = True,
        location_id: UUID | None = None,
        include_sublocations: bool = True,
        search: str | None = None,
        tags: list[str] | None = None,
        attribute_filters: dict[str, str] | None = None,
        low_stock_only: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Item]:
        """Get items with filtering and pagination."""
        query = self._base_query()

        if category_id:
            if include_subcategories:
                category_ids = await self._get_category_descendant_ids(category_id)
                query = query.where(Item.category_id.in_(category_ids))
            else:
                query = query.where(Item.category_id == category_id)

        if location_id:
            if include_sublocations:
                location_ids = await self._get_location_descendant_ids(location_id)
                query = query.where(Item.location_id.in_(location_ids))
            else:
                query = query.where(Item.location_id == location_id)

        if search:
            search_pattern = f"%{search}%"
            # Search in name, description, and tags
            query = query.where(
                or_(
                    Item.name.ilike(search_pattern),
                    Item.description.ilike(search_pattern),
                    Item.tags.any(search),  # Exact tag match
                )
            )

        # Filter by tags (items must have ALL specified tags)
        if tags:
            for tag in tags:
                query = query.where(Item.tags.any(tag))

        # Filter by JSONB attributes
        if attribute_filters:
            for key, value in attribute_filters.items():
                # Use JSONB containment operator for filtering
                query = query.where(
                    text("attributes @> :attr").bindparams(
                        attr=f'{{"{key}": "{value}"}}'
                    )
                )

        if low_stock_only:
            query = query.where(
                Item.min_quantity.isnot(None),
                Item.quantity < Item.min_quantity,
            )

        query = query.order_by(Item.updated_at.desc()).offset(offset).limit(limit)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        *,
        category_id: UUID | None = None,
        include_subcategories: bool = True,
        location_id: UUID | None = None,
        include_sublocations: bool = True,
        search: str | None = None,
        tags: list[str] | None = None,
        attribute_filters: dict[str, str] | None = None,
        low_stock_only: bool = False,
    ) -> int:
        """Count items with filtering."""
        query = select(func.count(Item.id)).where(Item.user_id == self.user_id)

        if category_id:
            if include_subcategories:
                category_ids = await self._get_category_descendant_ids(category_id)
                query = query.where(Item.category_id.in_(category_ids))
            else:
                query = query.where(Item.category_id == category_id)

        if location_id:
            if include_sublocations:
                location_ids = await self._get_location_descendant_ids(location_id)
                query = query.where(Item.location_id.in_(location_ids))
            else:
                query = query.where(Item.location_id == location_id)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Item.name.ilike(search_pattern),
                    Item.description.ilike(search_pattern),
                    Item.tags.any(search),
                )
            )

        if tags:
            for tag in tags:
                query = query.where(Item.tags.any(tag))

        if attribute_filters:
            for key, value in attribute_filters.items():
                query = query.where(
                    text("attributes @> :attr").bindparams(
                        attr=f'{{"{key}": "{value}"}}'
                    )
                )

        if low_stock_only:
            query = query.where(
                Item.min_quantity.isnot(None),
                Item.quantity < Item.min_quantity,
            )

        result = await self.session.execute(query)
        return result.scalar_one()

    async def get_by_id(self, item_id: UUID) -> Item | None:
        """Get an item by ID."""
        query = self._base_query().where(Item.id == item_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create(self, data: ItemCreate) -> Item:
        """Create a new item."""
        item = Item(
            user_id=self.user_id,
            name=data.name,
            description=data.description,
            category_id=data.category_id,
            location_id=data.location_id,
            quantity=data.quantity,
            quantity_unit=data.quantity_unit,
            min_quantity=data.min_quantity,
            attributes=data.attributes,
            tags=data.tags,
        )
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)

        # Reload with relationships
        return await self.get_by_id(item.id)  # type: ignore

    async def update(self, item: Item, data: ItemUpdate) -> Item:
        """Update an item."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)

        # Reload with relationships
        return await self.get_by_id(item.id)  # type: ignore

    async def update_quantity(self, item: Item, quantity: int) -> Item:
        """Update item quantity."""
        item.quantity = quantity
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete(self, item: Item) -> None:
        """Delete an item."""
        await self.session.delete(item)
        await self.session.commit()

    async def search(self, query: str, limit: int = 20) -> list[Item]:
        """Search items by name, description, or tags."""
        search_pattern = f"%{query}%"
        result = await self.session.execute(
            self._base_query()
            .where(
                or_(
                    Item.name.ilike(search_pattern),
                    Item.description.ilike(search_pattern),
                    Item.tags.any(query),
                )
            )
            .order_by(Item.name)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_facets(
        self,
        *,
        category_id: UUID | None = None,
        include_subcategories: bool = True,
        location_id: UUID | None = None,
        include_sublocations: bool = True,
        attribute_keys: list[str] | None = None,
    ) -> tuple[list[Facet], int]:
        """Get available facets (attribute values with counts) for filtering.

        Returns facets based on the category's attribute template if a category is specified,
        or all unique attribute keys found in items.
        """
        # Build base filter for items
        base_filters = [Item.user_id == self.user_id]

        if category_id:
            if include_subcategories:
                category_ids = await self._get_category_descendant_ids(category_id)
                base_filters.append(Item.category_id.in_(category_ids))
            else:
                base_filters.append(Item.category_id == category_id)

        if location_id:
            if include_sublocations:
                location_ids = await self._get_location_descendant_ids(location_id)
                base_filters.append(Item.location_id.in_(location_ids))
            else:
                base_filters.append(Item.location_id == location_id)

        # Count total items matching filters
        count_result = await self.session.execute(
            select(func.count(Item.id)).where(*base_filters)
        )
        total_items = count_result.scalar_one()

        facets: list[Facet] = []

        # If no specific keys provided, try to get them from category template
        if not attribute_keys and category_id:
            cat_result = await self.session.execute(
                select(Category).where(
                    Category.id == category_id,
                    Category.user_id == self.user_id,
                )
            )
            category = cat_result.scalar_one_or_none()
            if category and category.attribute_template:
                template = category.attribute_template
                if isinstance(template, dict) and "fields" in template:
                    attribute_keys = [f["name"] for f in template["fields"]]

        # If still no keys, find common attribute keys from items
        if not attribute_keys:
            # Get all unique top-level attribute keys from matching items
            keys_query = await self.session.execute(
                select(func.jsonb_object_keys(Item.attributes))
                .where(*base_filters)
                .distinct()
            )
            attribute_keys = [row[0] for row in keys_query.fetchall()]

        # For each attribute key, get value counts
        for key in attribute_keys or []:
            # Query to get distinct values and their counts
            value_query = await self.session.execute(
                select(
                    Item.attributes[key].astext.label("value"),
                    func.count(Item.id).label("count"),
                )
                .where(
                    *base_filters,
                    Item.attributes[key].isnot(None),
                    Item.attributes[key].astext != "",
                )
                .group_by(Item.attributes[key].astext)
                .order_by(func.count(Item.id).desc())
                .limit(50)  # Limit facet values
            )

            values = [
                FacetValue(value=str(row.value), count=row.count)
                for row in value_query.fetchall()
                if row.value
            ]

            if values:
                # Create a human-readable label from the key
                label = key.replace("_", " ").title()
                facets.append(Facet(name=key, label=label, values=values))

        return facets, total_items

    async def get_all_tags(self, limit: int = 100) -> list[tuple[str, int]]:
        """Get all unique tags with their counts."""
        # Use unnest to expand the array and count occurrences
        result = await self.session.execute(
            select(
                func.unnest(Item.tags).label("tag"),
                func.count().label("count"),
            )
            .where(Item.user_id == self.user_id)
            .group_by(text("tag"))
            .order_by(text("count DESC"))
            .limit(limit)
        )
        return [(row.tag, row.count) for row in result.fetchall()]
