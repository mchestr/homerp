"""
OpenAI function/tool definitions for HomERP AI assistant.

Defines available tools and their execution logic.
"""

from typing import Any

# Tool definitions for OpenAI function calling
INVENTORY_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_items",
            "description": (
                "Search inventory items by text query. "
                "Returns matching items with their details including specifications."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Search query to find items "
                            "(searches name, description, tags)"
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 10, max: 50)",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_item_details",
            "description": (
                "Get detailed information about a specific item by ID, "
                "including all specifications, category, location, and images."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {
                        "type": "string",
                        "description": "UUID of the item to retrieve",
                    },
                },
                "required": ["item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "filter_items",
            "description": (
                "Filter items by category, location, tags, or other attributes. "
                "Use this when user wants to see items in a specific category or location."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category_name": {
                        "type": "string",
                        "description": "Filter by category name (partial match)",
                    },
                    "location_name": {
                        "type": "string",
                        "description": "Filter by location name (partial match)",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Filter by tags (items must have ALL specified tags)"
                        ),
                    },
                    "low_stock_only": {
                        "type": "boolean",
                        "description": "Only return items below minimum quantity threshold",
                        "default": False,
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results (default: 20, max: 100)",
                        "default": 20,
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_similar_items",
            "description": (
                "Find items similar to a given item name based on name, "
                "category, and specifications. Useful for finding related items."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {
                        "type": "string",
                        "description": "Name of item to find similar matches for",
                    },
                    "category_path": {
                        "type": "string",
                        "description": (
                            "Optional category path to narrow similarity matching"
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results (default: 5)",
                        "default": 5,
                    },
                },
                "required": ["item_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_low_stock_items",
            "description": (
                "Get all items that are below their minimum stock threshold. "
                "Use this when user asks about items that need restocking."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results (default: 20)",
                        "default": 20,
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_inventory_summary",
            "description": (
                "Get a high-level summary of the user's inventory including "
                "total counts, categories, locations, and statistics."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


def format_item_for_tool(item: Any, include_specs: bool = False) -> dict[str, Any]:
    """Format an item for tool response, including navigation link.

    Args:
        item: The Item model instance
        include_specs: Whether to include full specifications

    Returns:
        Dictionary with item data formatted for AI consumption
    """
    result: dict[str, Any] = {
        "id": str(item.id),
        "name": item.name,
        "quantity": item.quantity,
        "quantity_unit": item.quantity_unit or "pcs",
        # Provide ready-to-use markdown link for AI to copy verbatim
        "markdown_link": f"[{item.name}](/items/{item.id})",
    }

    if item.description:
        # Truncate long descriptions to save context length
        result["description"] = (
            item.description[:200] + "..."
            if len(item.description) > 200
            else item.description
        )

    if item.category:
        result["category"] = (
            str(item.category.path) if item.category.path else item.category.name
        )

    if item.location:
        result["location"] = (
            str(item.location.path) if item.location.path else item.location.name
        )

    if item.tags:
        result["tags"] = item.tags

    # Check if item is low stock
    if item.min_quantity is not None and item.quantity < item.min_quantity:
        result["is_low_stock"] = True
        result["min_quantity"] = item.min_quantity

    if include_specs and item.attributes:
        specs = item.attributes.get("specifications", {})
        if specs:
            result["specifications"] = specs

    return result
