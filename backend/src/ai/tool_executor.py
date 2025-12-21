"""
Tool execution service for AI assistant.

Handles execution of OpenAI tool calls against the inventory.
"""

import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.tools import format_item_for_tool
from src.categories.models import Category
from src.items.repository import ItemRepository
from src.locations.models import Location

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes AI tool calls against the user's inventory."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id
        self.item_repo = ItemRepository(session, user_id)

    async def execute(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """Execute a tool and return the result as a JSON string.

        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments as parsed from OpenAI function call

        Returns:
            JSON string containing the tool result
        """
        logger.info(f"Executing tool: {tool_name} with args: {arguments}")

        try:
            if tool_name == "search_items":
                result = await self._search_items(arguments)
            elif tool_name == "get_item_details":
                result = await self._get_item_details(arguments)
            elif tool_name == "filter_items":
                result = await self._filter_items(arguments)
            elif tool_name == "find_similar_items":
                result = await self._find_similar_items(arguments)
            elif tool_name == "get_low_stock_items":
                result = await self._get_low_stock_items(arguments)
            elif tool_name == "get_inventory_summary":
                result = await self._get_inventory_summary(arguments)
            else:
                result = {"error": f"Unknown tool: {tool_name}"}

            return json.dumps(result, default=str)
        except Exception as e:
            logger.exception(f"Tool execution error: {tool_name} - {e}")
            return json.dumps({"error": str(e)})

    async def _search_items(self, args: dict[str, Any]) -> dict[str, Any]:
        """Search items by text query."""
        query = args.get("query", "")
        limit = min(args.get("limit", 10), 50)

        items = await self.item_repo.get_all(search=query, limit=limit)

        return {
            "items": [format_item_for_tool(item, include_specs=True) for item in items],
            "count": len(items),
            "query": query,
        }

    async def _get_item_details(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get detailed information about a specific item."""
        item_id = args.get("item_id")
        if not item_id:
            return {"error": "item_id is required"}

        try:
            item = await self.item_repo.get_by_id(UUID(item_id))
            if not item:
                return {"error": f"Item not found: {item_id}"}

            return format_item_for_tool(item, include_specs=True)
        except ValueError:
            return {"error": f"Invalid item_id format: {item_id}"}

    async def _filter_items(self, args: dict[str, Any]) -> dict[str, Any]:
        """Filter items by category, location, tags, etc."""
        limit = min(args.get("limit", 20), 100)
        low_stock_only = args.get("low_stock_only", False)
        tags = args.get("tags")

        # Get category ID from name if provided
        category_id = None
        if category_name := args.get("category_name"):
            cat_result = await self.session.execute(
                select(Category.id)
                .where(
                    Category.user_id == self.user_id,
                    or_(
                        Category.name.ilike(f"%{category_name}%"),
                        Category.path.cast(str).ilike(f"%{category_name}%"),
                    ),
                )
                .limit(1)
            )
            cat_row = cat_result.scalar_one_or_none()
            if cat_row:
                category_id = cat_row

        # Get location ID from name if provided
        location_id = None
        if location_name := args.get("location_name"):
            loc_result = await self.session.execute(
                select(Location.id)
                .where(
                    Location.user_id == self.user_id,
                    or_(
                        Location.name.ilike(f"%{location_name}%"),
                        Location.path.cast(str).ilike(f"%{location_name}%"),
                    ),
                )
                .limit(1)
            )
            loc_row = loc_result.scalar_one_or_none()
            if loc_row:
                location_id = loc_row

        items = await self.item_repo.get_all(
            category_id=category_id,
            location_id=location_id,
            tags=tags,
            low_stock_only=low_stock_only,
            limit=limit,
        )

        filters_applied = {k: v for k, v in args.items() if v and k != "limit"}

        return {
            "items": [format_item_for_tool(item, include_specs=True) for item in items],
            "count": len(items),
            "filters_applied": filters_applied,
        }

    async def _find_similar_items(self, args: dict[str, Any]) -> dict[str, Any]:
        """Find items similar to a given item name."""
        item_name = args.get("item_name", "")
        category_path = args.get("category_path")
        limit = min(args.get("limit", 5), 20)

        similar_items, total = await self.item_repo.find_similar(
            identified_name=item_name,
            category_path=category_path,
            limit=limit,
        )

        return {
            "similar_items": [
                {
                    **format_item_for_tool(item, include_specs=True),
                    "similarity_score": round(score, 2),
                    "match_reasons": reasons,
                }
                for item, score, reasons in similar_items
            ],
            "total_items_searched": total,
        }

    async def _get_low_stock_items(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get all items below their minimum stock threshold."""
        limit = min(args.get("limit", 20), 100)

        items = await self.item_repo.get_all(low_stock_only=True, limit=limit)

        return {
            "low_stock_items": [
                {
                    **format_item_for_tool(item),
                    "current_quantity": item.quantity,
                    "min_quantity": item.min_quantity,
                    "shortage": (item.min_quantity or 0) - item.quantity,
                }
                for item in items
            ],
            "count": len(items),
        }

    async def _get_inventory_summary(self, _args: dict[str, Any]) -> dict[str, Any]:
        """Get a high-level summary of the user's inventory."""
        stats = await self.item_repo.get_dashboard_stats(days=30)

        # Get low stock count
        low_stock_items = await self.item_repo.get_all(low_stock_only=True, limit=1000)

        return {
            "total_items": stats["total_items"],
            "total_quantity": stats["total_quantity"],
            "categories_used": stats["categories_used"],
            "locations_used": stats["locations_used"],
            "low_stock_count": len(low_stock_items),
            "top_categories": stats["items_by_category"][:5],
            "top_locations": stats["items_by_location"][:5],
        }
