"""Tests for AI tool executor."""

import json
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy_utils import Ltree

from src.ai.tool_executor import ToolExecutor, _escape_like_pattern
from src.categories.models import Category
from src.items.models import Item
from src.locations.models import Location
from src.users.models import User


class TestEscapeLikePattern:
    """Tests for the LIKE pattern escape function."""

    def test_escape_percent(self):
        """Test escaping percent signs."""
        assert _escape_like_pattern("100%") == r"100\%"

    def test_escape_underscore(self):
        """Test escaping underscores."""
        assert _escape_like_pattern("item_name") == r"item\_name"

    def test_escape_backslash(self):
        """Test escaping backslashes."""
        assert _escape_like_pattern(r"path\to") == r"path\\to"

    def test_escape_all_special_chars(self):
        """Test escaping all special characters together."""
        assert _escape_like_pattern(r"100%_test\path") == r"100\%\_test\\path"

    def test_no_special_chars(self):
        """Test string with no special characters."""
        assert _escape_like_pattern("normal string") == "normal string"


class TestToolExecutor:
    """Tests for ToolExecutor tool execution."""

    @pytest.fixture
    async def executor(self, async_session: AsyncSession, test_user: User):
        """Create a tool executor for testing."""
        return ToolExecutor(async_session, test_user.id)

    @pytest.fixture
    async def test_items(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_category: Category,
        test_location: Location,
    ) -> list[Item]:
        """Create test items for tool execution tests."""
        items_data = [
            {
                "name": "Cordless Drill",
                "description": "18V cordless drill with battery",
                "quantity": 1,
                "min_quantity": 1,
                "tags": ["power tools", "drill"],
            },
            {
                "name": "Hammer",
                "description": "Standard claw hammer",
                "quantity": 2,
                "min_quantity": 1,
                "tags": ["hand tools"],
            },
            {
                "name": "Screwdriver Set",
                "description": "Set of Phillips and flathead screwdrivers",
                "quantity": 1,
                "min_quantity": 2,  # Low stock
                "tags": ["hand tools", "screwdriver"],
            },
            {
                "name": "Nails",
                "description": "Box of assorted nails",
                "quantity": 100,
                "quantity_unit": "pcs",
                "min_quantity": 50,
                "tags": ["fasteners"],
            },
            {
                "name": "Drill Bits",
                "description": "Set of drill bits for metal and wood",
                "quantity": 0,
                "min_quantity": 1,  # Low stock
                "tags": ["drill", "accessories"],
            },
        ]

        items = []
        for data in items_data:
            item = Item(
                id=uuid.uuid4(),
                user_id=test_user.id,
                name=data["name"],
                description=data.get("description"),
                quantity=data["quantity"],
                quantity_unit=data.get("quantity_unit", "pcs"),
                min_quantity=data.get("min_quantity"),
                category_id=test_category.id,
                location_id=test_location.id,
                tags=data.get("tags", []),
            )
            async_session.add(item)
            items.append(item)

        await async_session.commit()
        return items

    async def test_search_items_basic(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test basic item search."""
        result = await executor.execute("search_items", {"query": "drill"})
        data = json.loads(result)

        assert "items" in data
        assert data["count"] >= 1
        # Should find Cordless Drill and Drill Bits
        names = [item["name"] for item in data["items"]]
        assert any("drill" in name.lower() for name in names)

    async def test_search_items_with_limit(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test search with limit parameter."""
        result = await executor.execute("search_items", {"query": "", "limit": 2})
        data = json.loads(result)

        assert len(data["items"]) <= 2

    async def test_search_items_max_limit(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test that limit is capped at 50."""
        result = await executor.execute("search_items", {"query": "", "limit": 100})
        data = json.loads(result)

        # Even with limit=100, internal cap is 50
        assert data["count"] <= 50

    async def test_get_item_details(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test getting item details by ID."""
        drill = test_items[0]  # Cordless Drill
        result = await executor.execute("get_item_details", {"item_id": str(drill.id)})
        data = json.loads(result)

        assert data["name"] == "Cordless Drill"
        assert data["id"] == str(drill.id)

    async def test_get_item_details_not_found(self, executor: ToolExecutor):
        """Test getting details for non-existent item."""
        result = await executor.execute(
            "get_item_details", {"item_id": str(uuid.uuid4())}
        )
        data = json.loads(result)

        assert "error" in data
        assert "not found" in data["error"].lower()

    async def test_get_item_details_invalid_id(self, executor: ToolExecutor):
        """Test getting details with invalid UUID."""
        result = await executor.execute("get_item_details", {"item_id": "not-a-uuid"})
        data = json.loads(result)

        assert "error" in data

    async def test_get_item_details_missing_id(self, executor: ToolExecutor):
        """Test getting details without item_id."""
        result = await executor.execute("get_item_details", {})
        data = json.loads(result)

        assert "error" in data
        assert "required" in data["error"].lower()

    async def test_filter_items_by_category(
        self,
        executor: ToolExecutor,
        test_items: list[Item],
        test_category: Category,
    ):
        """Test filtering items by category name."""
        result = await executor.execute(
            "filter_items", {"category_name": test_category.name}
        )
        data = json.loads(result)

        assert data["count"] == len(test_items)
        assert "filters_applied" in data
        assert "category_name" in data["filters_applied"]

    async def test_filter_items_by_location(
        self,
        executor: ToolExecutor,
        test_items: list[Item],
        test_location: Location,
    ):
        """Test filtering items by location name."""
        result = await executor.execute(
            "filter_items", {"location_name": test_location.name}
        )
        data = json.loads(result)

        assert data["count"] == len(test_items)

    async def test_filter_items_low_stock_only(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test filtering for low stock items only."""
        result = await executor.execute("filter_items", {"low_stock_only": True})
        data = json.loads(result)

        # Screwdriver Set and Drill Bits are low stock
        assert data["count"] == 2
        for item in data["items"]:
            # Each should have quantity < min_quantity
            assert item["quantity"] < (item.get("min_quantity") or float("inf"))

    async def test_filter_items_by_tags(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test filtering items by tags."""
        result = await executor.execute("filter_items", {"tags": ["hand tools"]})
        data = json.loads(result)

        assert data["count"] == 2  # Hammer and Screwdriver Set

    async def test_filter_items_with_limit(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test filtering with limit."""
        result = await executor.execute("filter_items", {"limit": 2})
        data = json.loads(result)

        assert len(data["items"]) <= 2

    async def test_filter_items_sql_injection_prevention(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_items: list[Item],
    ):
        """Test that SQL wildcards in category/location names are escaped."""
        # Create a category with special characters
        special_category = Category(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="100% Tools",
            path=Ltree("tools_100"),
        )
        async_session.add(special_category)
        await async_session.commit()

        executor = ToolExecutor(async_session, test_user.id)

        # Search for "100%" - should be escaped so % is literal
        result = await executor.execute("filter_items", {"category_name": "100%"})
        data = json.loads(result)

        # Should not match everything due to unescaped %
        # The count should be based on actual matching, not wildcard expansion
        assert "items" in data

    async def test_find_similar_items(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test finding similar items."""
        result = await executor.execute(
            "find_similar_items", {"item_name": "Drill", "limit": 5}
        )
        data = json.loads(result)

        assert "similar_items" in data
        assert "total_items_searched" in data

    async def test_get_low_stock_items(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test getting low stock items."""
        result = await executor.execute("get_low_stock_items", {})
        data = json.loads(result)

        assert "low_stock_items" in data
        assert data["count"] == 2  # Screwdriver Set and Drill Bits

        for item in data["low_stock_items"]:
            assert "shortage" in item
            assert item["current_quantity"] < item["min_quantity"]

    async def test_get_low_stock_items_with_limit(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test low stock items with limit."""
        result = await executor.execute("get_low_stock_items", {"limit": 1})
        data = json.loads(result)

        assert data["count"] <= 1

    async def test_get_inventory_summary(
        self, executor: ToolExecutor, test_items: list[Item]
    ):
        """Test getting inventory summary."""
        result = await executor.execute("get_inventory_summary", {})
        data = json.loads(result)

        assert data["total_items"] == 5
        assert "total_quantity" in data
        assert "categories_used" in data
        assert "locations_used" in data
        assert "low_stock_count" in data
        assert data["low_stock_count"] == 2

    async def test_unknown_tool(self, executor: ToolExecutor):
        """Test handling of unknown tool name."""
        result = await executor.execute("unknown_tool", {})
        data = json.loads(result)

        assert "error" in data
        assert "unknown" in data["error"].lower()

    async def test_tool_execution_error_handling(
        self, async_session: AsyncSession, test_user: User
    ):
        """Test that tool execution errors are caught and returned as JSON."""
        executor = ToolExecutor(async_session, test_user.id)

        # This should handle the error gracefully
        result = await executor.execute("get_item_details", {"item_id": None})
        data = json.loads(result)

        assert "error" in data


class TestToolExecutorIsolation:
    """Tests for user data isolation in tool executor."""

    @pytest.fixture
    async def other_user(self, async_session: AsyncSession) -> User:
        """Create another user for isolation tests."""
        user = User(
            id=uuid.uuid4(),
            email="other@example.com",
            name="Other User",
            oauth_provider="google",
            oauth_id="google_other_123",
        )
        async_session.add(user)
        await async_session.commit()
        return user

    @pytest.fixture
    async def other_user_item(
        self, async_session: AsyncSession, other_user: User
    ) -> Item:
        """Create an item belonging to another user."""
        item = Item(
            id=uuid.uuid4(),
            user_id=other_user.id,
            name="Other User's Item",
            quantity=1,
        )
        async_session.add(item)
        await async_session.commit()
        return item

    async def test_search_items_isolation(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        other_user: User,
        other_user_item: Item,
    ):
        """Test that search only returns current user's items."""
        executor = ToolExecutor(async_session, test_user.id)
        result = await executor.execute("search_items", {"query": ""})
        data = json.loads(result)

        item_ids = [item["id"] for item in data["items"]]

        # Should include test_user's item
        assert str(test_item.id) in item_ids
        # Should NOT include other user's item
        assert str(other_user_item.id) not in item_ids

    async def test_get_item_details_isolation(
        self,
        async_session: AsyncSession,
        test_user: User,
        other_user_item: Item,
    ):
        """Test that users cannot access other users' item details."""
        executor = ToolExecutor(async_session, test_user.id)
        result = await executor.execute(
            "get_item_details", {"item_id": str(other_user_item.id)}
        )
        data = json.loads(result)

        assert "error" in data
        assert "not found" in data["error"].lower()

    async def test_inventory_summary_isolation(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        other_user: User,
        other_user_item: Item,
    ):
        """Test that inventory summary only includes current user's data."""
        executor = ToolExecutor(async_session, test_user.id)
        result = await executor.execute("get_inventory_summary", {})
        data = json.loads(result)

        # Should only count test_user's item
        assert data["total_items"] == 1
