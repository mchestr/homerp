import json
from difflib import SequenceMatcher
from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy_utils import Ltree

from src.categories.models import Category
from src.items.models import Item, ItemCheckInOut
from src.items.schemas import (
    CheckInOutCreate,
    Facet,
    FacetValue,
    ItemCreate,
    ItemUpdate,
    ItemUsageStatsResponse,
    MostUsedItemResponse,
    RecentlyUsedItemResponse,
)
from src.locations.models import Location


class ItemRepository:
    """Repository for item database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def _validate_category_ownership(self, category_id: UUID | None) -> None:
        """Validate that the category belongs to the current user.

        Raises ValueError if the category doesn't exist or belongs to another user.
        """
        if category_id is None:
            return

        result = await self.session.execute(
            select(Category.id).where(
                Category.id == category_id,
                Category.user_id == self.user_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"Category {category_id} not found or access denied")

    async def _validate_location_ownership(self, location_id: UUID | None) -> None:
        """Validate that the location belongs to the current user.

        Raises ValueError if the location doesn't exist or belongs to another user.
        """
        if location_id is None:
            return

        result = await self.session.execute(
            select(Location.id).where(
                Location.id == location_id,
                Location.user_id == self.user_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"Location {location_id} not found or access denied")

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
            parent_path = str(category.path)
            result = await self.session.execute(
                select(Category.id).where(
                    Category.user_id == self.user_id,
                    Category.path.op("<@")(Ltree(parent_path)),
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
            parent_path = str(location.path)
            result = await self.session.execute(
                select(Location.id).where(
                    Location.user_id == self.user_id,
                    Location.path.op("<@")(Ltree(parent_path)),
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
                        attr=json.dumps({key: value})
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
                        attr=json.dumps({key: value})
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

    async def get_by_id_for_update(self, item_id: UUID) -> Item | None:
        """Get an item by ID with a row-level lock for update.

        Uses SELECT ... FOR UPDATE to prevent race conditions during
        concurrent check-in/check-out operations.
        """
        query = self._base_query().where(Item.id == item_id).with_for_update()
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create(self, data: ItemCreate) -> Item:
        """Create a new item.

        Validates that category_id and location_id belong to the current user.
        Raises ValueError if validation fails.
        """
        # Validate foreign key ownership before creating
        await self._validate_category_ownership(data.category_id)
        await self._validate_location_ownership(data.location_id)

        item = Item(
            user_id=self.user_id,
            name=data.name,
            description=data.description,
            category_id=data.category_id,
            location_id=data.location_id,
            quantity=data.quantity,
            quantity_unit=data.quantity_unit,
            min_quantity=data.min_quantity,
            price=data.price,
            attributes=data.attributes,
            tags=data.tags,
        )
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)

        # Reload with relationships
        return await self.get_by_id(item.id)  # type: ignore

    async def update(self, item: Item, data: ItemUpdate) -> Item:
        """Update an item.

        Validates that category_id and location_id belong to the current user
        if they are being updated. Raises ValueError if validation fails.
        """
        update_data = data.model_dump(exclude_unset=True)

        # Validate foreign key ownership if being updated
        if "category_id" in update_data:
            await self._validate_category_ownership(update_data["category_id"])
        if "location_id" in update_data:
            await self._validate_location_ownership(update_data["location_id"])

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

        # Reload with relationships
        return await self.get_by_id(item.id)  # type: ignore

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

    async def get_dashboard_stats(self, days: int = 30) -> dict:
        """Get dashboard statistics including time series data."""
        from datetime import UTC, datetime, timedelta

        # Items created over time (last N days)
        start_date = datetime.now(UTC) - timedelta(days=days)

        date_trunc_expr = func.date_trunc("day", Item.created_at)
        items_over_time_result = await self.session.execute(
            select(
                date_trunc_expr.label("date"),
                func.count(Item.id).label("count"),
            )
            .where(
                Item.user_id == self.user_id,
                Item.created_at >= start_date,
            )
            .group_by(date_trunc_expr)
            .order_by(date_trunc_expr)
        )
        items_over_time = [
            {"date": row.date.strftime("%Y-%m-%d"), "count": row.count}
            for row in items_over_time_result.fetchall()
        ]

        # Fill in missing dates with 0 counts
        date_counts = {item["date"]: item["count"] for item in items_over_time}
        filled_data = []
        current_date = start_date.date()
        end_date = datetime.now(UTC).date()
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            filled_data.append(
                {"date": date_str, "count": date_counts.get(date_str, 0)}
            )
            current_date += timedelta(days=1)

        # Items by category
        items_by_category_result = await self.session.execute(
            select(
                func.coalesce(Category.name, "Uncategorized").label("name"),
                func.count(Item.id).label("count"),
            )
            .select_from(Item)
            .outerjoin(Category, Item.category_id == Category.id)
            .where(Item.user_id == self.user_id)
            .group_by(Category.name)
            .order_by(func.count(Item.id).desc())
            .limit(10)
        )
        items_by_category = [
            {"name": row.name, "count": row.count}
            for row in items_by_category_result.fetchall()
        ]

        # Items by location
        items_by_location_result = await self.session.execute(
            select(
                func.coalesce(Location.name, "No Location").label("name"),
                func.count(Item.id).label("count"),
            )
            .select_from(Item)
            .outerjoin(Location, Item.location_id == Location.id)
            .where(Item.user_id == self.user_id)
            .group_by(Location.name)
            .order_by(func.count(Item.id).desc())
            .limit(10)
        )
        items_by_location = [
            {"name": row.name, "count": row.count}
            for row in items_by_location_result.fetchall()
        ]

        # Total items
        total_items_result = await self.session.execute(
            select(func.count(Item.id)).where(Item.user_id == self.user_id)
        )
        total_items = total_items_result.scalar_one()

        # Total quantity
        total_quantity_result = await self.session.execute(
            select(func.coalesce(func.sum(Item.quantity), 0)).where(
                Item.user_id == self.user_id
            )
        )
        total_quantity = total_quantity_result.scalar_one()

        # Categories used
        categories_used_result = await self.session.execute(
            select(func.count(func.distinct(Item.category_id))).where(
                Item.user_id == self.user_id,
                Item.category_id.isnot(None),
            )
        )
        categories_used = categories_used_result.scalar_one()

        # Locations used
        locations_used_result = await self.session.execute(
            select(func.count(func.distinct(Item.location_id))).where(
                Item.user_id == self.user_id,
                Item.location_id.isnot(None),
            )
        )
        locations_used = locations_used_result.scalar_one()

        return {
            "items_over_time": filled_data,
            "items_by_category": items_by_category,
            "items_by_location": items_by_location,
            "total_items": total_items,
            "total_quantity": total_quantity,
            "categories_used": categories_used,
            "locations_used": locations_used,
        }

    # Check-in/out methods

    async def create_check_in_out(
        self, item_id: UUID, action_type: str, data: CheckInOutCreate
    ) -> ItemCheckInOut:
        """Create a check-in or check-out record."""
        from datetime import UTC, datetime

        record = ItemCheckInOut(
            user_id=self.user_id,
            item_id=item_id,
            action_type=action_type,
            quantity=data.quantity,
            notes=data.notes,
            occurred_at=data.occurred_at or datetime.now(UTC),
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def get_check_in_out_history(
        self, item_id: UUID, page: int = 1, limit: int = 20
    ) -> tuple[list[ItemCheckInOut], int]:
        """Get paginated check-in/out history for an item."""
        offset = (page - 1) * limit

        # Count total
        count_result = await self.session.execute(
            select(func.count(ItemCheckInOut.id)).where(
                ItemCheckInOut.user_id == self.user_id,
                ItemCheckInOut.item_id == item_id,
            )
        )
        total = count_result.scalar_one()

        # Get paginated records
        result = await self.session.execute(
            select(ItemCheckInOut)
            .where(
                ItemCheckInOut.user_id == self.user_id,
                ItemCheckInOut.item_id == item_id,
            )
            .order_by(ItemCheckInOut.occurred_at.desc())
            .offset(offset)
            .limit(limit)
        )
        records = list(result.scalars().all())

        return records, total

    async def get_usage_stats(self, item_id: UUID) -> ItemUsageStatsResponse:
        """Get aggregated usage statistics for an item."""
        # Get check-out stats
        checkout_result = await self.session.execute(
            select(
                func.count(ItemCheckInOut.id).label("count"),
                func.coalesce(func.sum(ItemCheckInOut.quantity), 0).label("total_qty"),
                func.max(ItemCheckInOut.occurred_at).label("last"),
            ).where(
                ItemCheckInOut.user_id == self.user_id,
                ItemCheckInOut.item_id == item_id,
                ItemCheckInOut.action_type == "check_out",
            )
        )
        checkout_row = checkout_result.fetchone()

        # Get check-in stats
        checkin_result = await self.session.execute(
            select(
                func.count(ItemCheckInOut.id).label("count"),
                func.coalesce(func.sum(ItemCheckInOut.quantity), 0).label("total_qty"),
                func.max(ItemCheckInOut.occurred_at).label("last"),
            ).where(
                ItemCheckInOut.user_id == self.user_id,
                ItemCheckInOut.item_id == item_id,
                ItemCheckInOut.action_type == "check_in",
            )
        )
        checkin_row = checkin_result.fetchone()

        total_out = checkout_row.total_qty if checkout_row else 0
        total_in = checkin_row.total_qty if checkin_row else 0

        return ItemUsageStatsResponse(
            total_check_outs=checkout_row.count if checkout_row else 0,
            total_check_ins=checkin_row.count if checkin_row else 0,
            total_quantity_out=int(total_out),
            total_quantity_in=int(total_in),
            last_check_out=checkout_row.last if checkout_row else None,
            last_check_in=checkin_row.last if checkin_row else None,
            currently_checked_out=int(total_out) - int(total_in),
        )

    async def get_most_used_items(self, limit: int = 5) -> list[MostUsedItemResponse]:
        """Get items sorted by total check-outs for dashboard."""
        result = await self.session.execute(
            select(
                Item.id,
                Item.name,
                func.count(ItemCheckInOut.id).label("total_check_outs"),
            )
            .select_from(Item)
            .join(ItemCheckInOut, ItemCheckInOut.item_id == Item.id)
            .where(
                Item.user_id == self.user_id,
                ItemCheckInOut.action_type == "check_out",
            )
            .group_by(Item.id, Item.name)
            .order_by(func.count(ItemCheckInOut.id).desc())
            .limit(limit)
        )
        rows = result.fetchall()

        # Get primary images for these items
        if rows:
            item_ids = [row.id for row in rows]
            items_with_images = await self.session.execute(
                self._base_query().where(Item.id.in_(item_ids))
            )
            items_map = {item.id: item for item in items_with_images.scalars().all()}

            return [
                MostUsedItemResponse(
                    id=row.id,
                    name=row.name,
                    total_check_outs=row.total_check_outs,
                    primary_image_url=self._get_primary_image_url(
                        items_map.get(row.id)
                    ),
                )
                for row in rows
            ]
        return []

    async def get_recently_used_items(
        self, limit: int = 5
    ) -> list[RecentlyUsedItemResponse]:
        """Get items sorted by most recent activity."""
        # Subquery to get latest activity per item
        subquery = (
            select(
                ItemCheckInOut.item_id,
                func.max(ItemCheckInOut.occurred_at).label("last_used"),
            )
            .where(ItemCheckInOut.user_id == self.user_id)
            .group_by(ItemCheckInOut.item_id)
            .subquery()
        )

        # Get items with their latest activity
        result = await self.session.execute(
            select(
                Item.id,
                Item.name,
                subquery.c.last_used,
                ItemCheckInOut.action_type,
            )
            .select_from(Item)
            .join(subquery, subquery.c.item_id == Item.id)
            .join(
                ItemCheckInOut,
                (ItemCheckInOut.item_id == Item.id)
                & (ItemCheckInOut.occurred_at == subquery.c.last_used),
            )
            .where(Item.user_id == self.user_id)
            .order_by(subquery.c.last_used.desc())
            .limit(limit)
        )
        rows = result.fetchall()

        # Get primary images for these items
        if rows:
            item_ids = [row.id for row in rows]
            items_with_images = await self.session.execute(
                self._base_query().where(Item.id.in_(item_ids))
            )
            items_map = {item.id: item for item in items_with_images.scalars().all()}

            return [
                RecentlyUsedItemResponse(
                    id=row.id,
                    name=row.name,
                    last_used=row.last_used,
                    action_type=row.action_type,
                    primary_image_url=self._get_primary_image_url(
                        items_map.get(row.id)
                    ),
                )
                for row in rows
            ]
        return []

    def _get_primary_image_url(self, item: Item | None) -> str | None:
        """Get the primary image URL for an item."""
        if item and item.images:
            primary = (
                next((img for img in item.images if img.is_primary), None)
                or item.images[0]
            )
            return f"/api/v1/images/{primary.id}/file"
        return None

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between two names using SequenceMatcher.

        Normalizes names by lowercasing and returns a score between 0 and 1.
        """
        name1_lower = name1.lower().strip()
        name2_lower = name2.lower().strip()

        # Check for exact match
        if name1_lower == name2_lower:
            return 1.0

        # Check if one is substring of other
        if name1_lower in name2_lower or name2_lower in name1_lower:
            shorter = min(len(name1_lower), len(name2_lower))
            longer = max(len(name1_lower), len(name2_lower))
            return 0.7 + (0.3 * shorter / longer)

        # Use SequenceMatcher for fuzzy matching
        return SequenceMatcher(None, name1_lower, name2_lower).ratio()

    def _extract_key_terms(self, name: str) -> set[str]:
        """Extract key terms from a name for matching.

        Filters out common words to focus on meaningful terms.
        """
        common_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "with",
            "for",
            "of",
            "in",
            "on",
            "to",
            "mm",
            "cm",
            "m",
            "inch",
            "pcs",
            "pack",
            "box",
            "set",
        }
        words = name.lower().split()
        return {w for w in words if w not in common_words and len(w) > 1}

    async def find_similar(
        self,
        identified_name: str,
        category_path: str | None = None,
        specifications: dict | None = None,
        limit: int = 5,
    ) -> tuple[list[tuple[Item, float, list[str]]], int]:
        """Find items similar to the given classification result.

        Uses multiple matching strategies:
        1. Direct name similarity (fuzzy matching)
        2. Key term overlap
        3. Category path matching (if AI suggested a category)
        4. Specification matching (if available)

        Scoring weights:
        - Name similarity: 50% (exact=1.0, substring=0.7-1.0, fuzzy=ratio)
        - Key term overlap: 25% (Jaccard similarity of non-common words)
        - Category matching: 15% (any category path part matches)
        - Specification matching: 10% (max 0.05 per spec, capped at 0.1)

        Threshold: Items with score < 0.15 are excluded.

        Returns a list of (item, similarity_score, match_reasons) tuples
        and the total number of items searched.
        """
        # Extract key terms from the identified name for pre-filtering
        search_terms = self._extract_key_terms(identified_name)

        # Build a pre-filter query to narrow down candidates using DB-level filtering
        # This avoids loading all items into memory
        pre_filter_conditions = []

        # Add ILIKE conditions for key terms (OR logic - match any term)
        if search_terms:
            term_conditions = [
                Item.name.ilike(f"%{term}%") for term in list(search_terms)[:5]
            ]
            if term_conditions:
                pre_filter_conditions.append(or_(*term_conditions))

        # Also search for the full name as a substring
        pre_filter_conditions.append(
            Item.name.ilike(
                f"%{identified_name.split()[0] if identified_name else ''}%"
            )
        )

        # First pass: get candidate items (names only, no eager loading)
        # Limit to 500 candidates for performance
        base_query = select(
            Item.id, Item.name, Item.category_id, Item.attributes
        ).where(Item.user_id == self.user_id)

        if pre_filter_conditions:
            base_query = base_query.where(or_(*pre_filter_conditions))

        base_query = base_query.order_by(Item.updated_at.desc()).limit(500)

        result = await self.session.execute(base_query)
        candidates = list(result.fetchall())

        # Get total count for reporting
        count_result = await self.session.execute(
            select(func.count(Item.id)).where(Item.user_id == self.user_id)
        )
        total_searched = count_result.scalar_one()

        if not candidates:
            return [], total_searched

        # Parse category path parts for matching
        category_parts = []
        if category_path:
            category_parts = [
                p.strip().lower() for p in category_path.split(">") if p.strip()
            ]

        # Get category names for matching (only if we have category path)
        category_names: dict[str, str] = {}
        if category_parts:
            category_ids = {c.category_id for c in candidates if c.category_id}
            if category_ids:
                cat_result = await self.session.execute(
                    select(Category.id, Category.name).where(
                        Category.id.in_(category_ids)
                    )
                )
                category_names = {
                    str(row.id): row.name for row in cat_result.fetchall()
                }

        # Score candidates without full item loading
        scored_candidates: list[tuple[str, float, list[str]]] = []

        for candidate in candidates:
            item_id = str(candidate.id)
            item_name = candidate.name
            item_cat_id = str(candidate.category_id) if candidate.category_id else None
            item_attrs = candidate.attributes or {}

            score = 0.0
            reasons: list[str] = []

            # 1. Name similarity (weight: 0.5)
            name_sim = self._calculate_name_similarity(identified_name, item_name)
            if name_sim > 0.3:
                score += name_sim * 0.5
                if name_sim > 0.7:
                    reasons.append("Similar name")
                elif name_sim > 0.5:
                    reasons.append("Partial name match")

            # 2. Key term overlap (weight: 0.25)
            item_terms = self._extract_key_terms(item_name)
            if search_terms and item_terms:
                common_terms = search_terms & item_terms
                term_overlap = len(common_terms) / max(
                    len(search_terms), len(item_terms)
                )
                if term_overlap > 0:
                    score += term_overlap * 0.25
                    if term_overlap > 0.5:
                        reasons.append(f"Matching terms: {', '.join(common_terms)}")

            # 3. Category matching (weight: 0.15)
            if category_parts and item_cat_id and item_cat_id in category_names:
                item_cat_name = category_names[item_cat_id].lower()
                for cat_part in category_parts:
                    if cat_part in item_cat_name or item_cat_name in cat_part:
                        score += 0.15
                        reasons.append(f"Category: {category_names[item_cat_id]}")
                        break

            # 4. Specification matching (weight: 0.1)
            if specifications and item_attrs:
                matching_specs = []
                for key, value in specifications.items():
                    if key in item_attrs:
                        item_val = str(item_attrs[key]).lower()
                        spec_val = str(value).lower()
                        if item_val == spec_val:
                            matching_specs.append(f"{key}: {value}")
                        elif spec_val in item_val or item_val in spec_val:
                            matching_specs.append(f"{key}: ~{value}")
                if matching_specs:
                    score += min(len(matching_specs) * 0.05, 0.1)
                    reasons.append(f"Specs: {', '.join(matching_specs[:3])}")

            # Only include items with meaningful similarity
            if score > 0.15 and reasons:
                scored_candidates.append((item_id, min(score, 1.0), reasons))

        # Sort by score descending and take top matches
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        top_candidates = scored_candidates[:limit]

        if not top_candidates:
            return [], total_searched

        # Now load full items with relationships only for the top matches
        top_ids = [UUID(c[0]) for c in top_candidates]
        full_result = await self.session.execute(
            self._base_query().where(Item.id.in_(top_ids))
        )
        items_map = {item.id: item for item in full_result.scalars().all()}

        # Build final result maintaining score order
        final_results: list[tuple[Item, float, list[str]]] = []
        for item_id_str, score, reasons in top_candidates:
            item = items_map.get(UUID(item_id_str))
            if item:
                final_results.append((item, score, reasons))

        return final_results, total_searched
