"""HTTP integration tests for admin AI usage endpoints."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.models import AIUsageLog
from src.users.models import User


@pytest.fixture
async def ai_usage_logs(
    async_session: AsyncSession, test_user: User
) -> list[AIUsageLog]:
    """Create test AI usage logs."""
    logs = [
        AIUsageLog(
            user_id=test_user.id,
            operation_type="image_classification",
            model="gpt-4o",
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
            estimated_cost_usd=Decimal("0.015"),
            request_metadata={"image_count": 2},
        ),
        AIUsageLog(
            user_id=test_user.id,
            operation_type="assistant_query",
            model="gpt-4o",
            prompt_tokens=2000,
            completion_tokens=1000,
            total_tokens=3000,
            estimated_cost_usd=Decimal("0.030"),
            request_metadata={"prompt_length": 100},
        ),
        AIUsageLog(
            user_id=test_user.id,
            operation_type="location_analysis",
            model="gpt-4o-mini",
            prompt_tokens=500,
            completion_tokens=250,
            total_tokens=750,
            estimated_cost_usd=Decimal("0.003"),
            request_metadata={"image_id": "test-id"},
        ),
    ]
    for log in logs:
        async_session.add(log)
    await async_session.commit()
    for log in logs:
        await async_session.refresh(log)
    return logs


class TestAIUsageSummaryEndpoint:
    """Tests for GET /api/v1/admin/ai-usage/summary."""

    async def test_get_summary_as_admin(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test getting AI usage summary as admin."""
        response = await admin_client.get("/api/v1/admin/ai-usage/summary")

        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 3
        assert data["total_tokens"] == 5250  # 1500 + 3000 + 750
        assert data["total_prompt_tokens"] == 3500  # 1000 + 2000 + 500
        assert data["total_completion_tokens"] == 1750  # 500 + 1000 + 250
        assert len(data["by_operation"]) > 0
        assert len(data["by_model"]) > 0

    async def test_get_summary_empty(self, admin_client: AsyncClient):
        """Test getting summary with no data."""
        response = await admin_client.get("/api/v1/admin/ai-usage/summary")

        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 0
        assert data["total_tokens"] == 0

    async def test_get_summary_as_non_admin(
        self, authenticated_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/ai-usage/summary")

        assert response.status_code == 403

    async def test_get_summary_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/admin/ai-usage/summary")

        assert response.status_code == 401


class TestAIUsageByUserEndpoint:
    """Tests for GET /api/v1/admin/ai-usage/by-user."""

    async def test_get_by_user_as_admin(
        self,
        admin_client: AsyncClient,
        ai_usage_logs: list[AIUsageLog],
        test_user: User,
    ):
        """Test getting AI usage by user as admin."""
        response = await admin_client.get("/api/v1/admin/ai-usage/by-user")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Find the test user's usage
        user_usage = next((u for u in data if u["user_id"] == str(test_user.id)), None)
        assert user_usage is not None
        assert user_usage["total_calls"] == 3
        assert user_usage["total_tokens"] == 5250

    async def test_get_by_user_includes_user_info(
        self,
        admin_client: AsyncClient,
        ai_usage_logs: list[AIUsageLog],
        test_user: User,
    ):
        """Test that by-user endpoint includes user email and name."""
        response = await admin_client.get("/api/v1/admin/ai-usage/by-user")

        assert response.status_code == 200
        data = response.json()
        # Find the test user's usage
        user_usage = next((u for u in data if u["user_id"] == str(test_user.id)), None)
        assert user_usage is not None
        # Verify user info fields are present
        assert "user_email" in user_usage
        assert "user_name" in user_usage
        assert user_usage["user_email"] == test_user.email

    async def test_get_by_user_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/ai-usage/by-user")

        assert response.status_code == 403


class TestAIUsageHistoryEndpoint:
    """Tests for GET /api/v1/admin/ai-usage/history."""

    async def test_get_history_as_admin(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test getting AI usage history as admin."""
        response = await admin_client.get("/api/v1/admin/ai-usage/history")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_get_history_includes_user_info(
        self,
        admin_client: AsyncClient,
        ai_usage_logs: list[AIUsageLog],
        test_user: User,
    ):
        """Test that history includes user email and name."""
        response = await admin_client.get("/api/v1/admin/ai-usage/history")

        assert response.status_code == 200
        data = response.json()
        # Verify user info fields are present in each item
        for item in data["items"]:
            assert "user_email" in item
            assert "user_name" in item
            # Email should be the test user's email
            assert item["user_email"] == test_user.email

    async def test_get_history_with_pagination(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test paginating history."""
        response = await admin_client.get(
            "/api/v1/admin/ai-usage/history?page=1&limit=2"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3

    async def test_get_history_with_operation_filter(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test filtering by operation type."""
        response = await admin_client.get(
            "/api/v1/admin/ai-usage/history?operation_type=image_classification"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["operation_type"] == "image_classification"

    async def test_get_history_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/ai-usage/history")

        assert response.status_code == 403


class TestAIUsageDailyEndpoint:
    """Tests for GET /api/v1/admin/ai-usage/daily."""

    async def test_get_daily_as_admin(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test getting daily AI usage as admin."""
        response = await admin_client.get("/api/v1/admin/ai-usage/daily")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one day with data
        if len(data) > 0:
            assert "date" in data[0]
            assert "total_calls" in data[0]
            assert "total_tokens" in data[0]
            assert "total_cost_usd" in data[0]

    async def test_get_daily_with_days_param(
        self, admin_client: AsyncClient, ai_usage_logs: list[AIUsageLog]
    ):
        """Test getting daily usage with custom days parameter."""
        response = await admin_client.get("/api/v1/admin/ai-usage/daily?days=7")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_get_daily_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/ai-usage/daily")

        assert response.status_code == 403
