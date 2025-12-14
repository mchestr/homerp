"""Tests for profile router endpoints."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.profile.models import PurgeRecommendation, UserSystemProfile
from src.users.models import User


@pytest.fixture
async def test_system_profile(
    async_session: AsyncSession, test_user: User
) -> UserSystemProfile:
    """Create a test user system profile."""
    profile = UserSystemProfile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        hobby_types=["electronics", "woodworking"],
        interest_category_ids=[],
        retention_months=12,
        min_quantity_threshold=5,
        min_value_keep=Decimal("10.00"),
        profile_description="I'm an electronics hobbyist who also does woodworking.",
        purge_aggressiveness="moderate",
    )
    async_session.add(profile)
    await async_session.commit()
    await async_session.refresh(profile)
    return profile


@pytest.fixture
async def test_purge_recommendation(
    async_session: AsyncSession,
    test_user: User,
    test_item,
) -> PurgeRecommendation:
    """Create a test purge recommendation."""
    recommendation = PurgeRecommendation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        item_id=test_item.id,
        reason="This item hasn't been used in over 12 months.",
        confidence=Decimal("0.85"),
        factors={
            "unused_duration": True,
            "high_quantity": False,
            "low_value": False,
            "not_matching_interests": False,
        },
        status="pending",
    )
    async_session.add(recommendation)
    await async_session.commit()
    await async_session.refresh(recommendation)
    return recommendation


class TestHobbyTypes:
    """Tests for hobby types endpoint."""

    @pytest.mark.asyncio
    async def test_get_hobby_types(self, authenticated_client: AsyncClient):
        """Test getting available hobby types."""
        response = await authenticated_client.get("/api/v1/profile/hobby-types")
        assert response.status_code == 200
        data = response.json()
        assert "hobby_types" in data
        assert isinstance(data["hobby_types"], list)
        assert "electronics" in data["hobby_types"]
        assert "woodworking" in data["hobby_types"]


class TestUserSystemProfile:
    """Tests for user system profile endpoints."""

    @pytest.mark.asyncio
    async def test_get_profile_not_found(self, authenticated_client: AsyncClient):
        """Test getting profile when none exists."""
        response = await authenticated_client.get("/api/v1/profile/me")
        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.asyncio
    async def test_get_profile_exists(
        self,
        authenticated_client: AsyncClient,
        test_system_profile: UserSystemProfile,
    ):
        """Test getting existing profile."""
        response = await authenticated_client.get("/api/v1/profile/me")
        assert response.status_code == 200
        data = response.json()
        assert data["hobby_types"] == ["electronics", "woodworking"]
        assert data["retention_months"] == 12
        assert data["purge_aggressiveness"] == "moderate"

    @pytest.mark.asyncio
    async def test_create_profile(self, authenticated_client: AsyncClient):
        """Test creating a new profile."""
        response = await authenticated_client.post(
            "/api/v1/profile/me",
            json={
                "hobby_types": ["3d_printing", "electronics"],
                "retention_months": 6,
                "min_quantity_threshold": 10,
                "purge_aggressiveness": "aggressive",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hobby_types"] == ["3d_printing", "electronics"]
        assert data["retention_months"] == 6
        assert data["purge_aggressiveness"] == "aggressive"

    @pytest.mark.asyncio
    async def test_update_profile(
        self,
        authenticated_client: AsyncClient,
        test_system_profile: UserSystemProfile,
    ):
        """Test updating existing profile."""
        response = await authenticated_client.patch(
            "/api/v1/profile/me",
            json={
                "hobby_types": ["metalworking"],
                "retention_months": 24,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hobby_types"] == ["metalworking"]
        assert data["retention_months"] == 24
        # Unchanged fields should remain
        assert data["purge_aggressiveness"] == "moderate"

    @pytest.mark.asyncio
    async def test_update_profile_not_found(self, authenticated_client: AsyncClient):
        """Test updating profile when none exists."""
        response = await authenticated_client.patch(
            "/api/v1/profile/me",
            json={"retention_months": 24},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_profile_upsert(
        self,
        authenticated_client: AsyncClient,
        test_system_profile: UserSystemProfile,
    ):
        """Test POST creates or updates (upsert behavior)."""
        response = await authenticated_client.post(
            "/api/v1/profile/me",
            json={
                "hobby_types": ["sewing"],
                "retention_months": 3,
                "purge_aggressiveness": "conservative",
            },
        )
        assert response.status_code == 200
        data = response.json()
        # Should have updated the existing profile
        assert data["hobby_types"] == ["sewing"]
        assert data["retention_months"] == 3
        assert data["purge_aggressiveness"] == "conservative"


class TestPurgeRecommendations:
    """Tests for purge recommendation endpoints."""

    @pytest.mark.asyncio
    async def test_get_recommendations_empty(self, authenticated_client: AsyncClient):
        """Test getting recommendations when none exist."""
        response = await authenticated_client.get("/api/v1/profile/recommendations")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_recommendations(
        self,
        authenticated_client: AsyncClient,
        test_purge_recommendation: PurgeRecommendation,
    ):
        """Test getting pending recommendations."""
        response = await authenticated_client.get("/api/v1/profile/recommendations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["reason"] == "This item hasn't been used in over 12 months."
        assert data[0]["status"] == "pending"
        assert "item_name" in data[0]

    @pytest.mark.asyncio
    async def test_update_recommendation_accept(
        self,
        authenticated_client: AsyncClient,
        test_purge_recommendation: PurgeRecommendation,
    ):
        """Test accepting a recommendation."""
        response = await authenticated_client.patch(
            f"/api/v1/profile/recommendations/{test_purge_recommendation.id}",
            json={
                "status": "accepted",
                "user_feedback": "Good recommendation, I'll purge this item.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"
        assert data["user_feedback"] == "Good recommendation, I'll purge this item."
        assert data["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_update_recommendation_dismiss(
        self,
        authenticated_client: AsyncClient,
        test_purge_recommendation: PurgeRecommendation,
    ):
        """Test dismissing a recommendation."""
        response = await authenticated_client.patch(
            f"/api/v1/profile/recommendations/{test_purge_recommendation.id}",
            json={"status": "dismissed"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dismissed"

    @pytest.mark.asyncio
    async def test_delete_recommendation(
        self,
        authenticated_client: AsyncClient,
        test_purge_recommendation: PurgeRecommendation,
    ):
        """Test dismissing a recommendation via DELETE."""
        response = await authenticated_client.delete(
            f"/api/v1/profile/recommendations/{test_purge_recommendation.id}"
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_recommendation_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test updating non-existent recommendation."""
        response = await authenticated_client.patch(
            f"/api/v1/profile/recommendations/{uuid.uuid4()}",
            json={"status": "accepted"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_recommendations_no_profile(
        self, authenticated_client: AsyncClient
    ):
        """Test generating recommendations without a profile."""
        response = await authenticated_client.post(
            "/api/v1/profile/recommendations/generate",
            json={"max_recommendations": 5},
        )
        assert response.status_code == 400
        assert "profile" in response.json()["detail"].lower()


class TestDeclutterCost:
    """Tests for declutter cost estimation endpoint."""

    @pytest.mark.asyncio
    async def test_get_cost_default_items(self, authenticated_client: AsyncClient):
        """Test getting cost with default items_to_analyze."""
        response = await authenticated_client.get(
            "/api/v1/profile/recommendations/cost"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items_to_analyze"] == 50
        assert data["credits_required"] == 1  # 50 items = 1 credit
        assert data["items_per_credit"] == 50
        assert "has_sufficient_credits" in data
        assert "user_credit_balance" in data
        assert "total_items" in data
        assert data["has_profile"] is False

    @pytest.mark.asyncio
    async def test_get_cost_with_items_to_analyze(
        self, authenticated_client: AsyncClient
    ):
        """Test getting cost with custom items_to_analyze."""
        response = await authenticated_client.get(
            "/api/v1/profile/recommendations/cost?items_to_analyze=100"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items_to_analyze"] == 100
        assert data["credits_required"] == 2  # 100 items = 2 credits

    @pytest.mark.asyncio
    async def test_get_cost_rejects_below_minimum(
        self, authenticated_client: AsyncClient
    ):
        """Test that items_to_analyze below 10 returns validation error."""
        response = await authenticated_client.get(
            "/api/v1/profile/recommendations/cost?items_to_analyze=5"
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_cost_rejects_above_maximum(
        self, authenticated_client: AsyncClient
    ):
        """Test that items_to_analyze above 200 returns validation error."""
        response = await authenticated_client.get(
            "/api/v1/profile/recommendations/cost?items_to_analyze=500"
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_cost_with_profile(
        self,
        authenticated_client: AsyncClient,
        test_system_profile: UserSystemProfile,
    ):
        """Test getting cost when user has a profile."""
        response = await authenticated_client.get(
            "/api/v1/profile/recommendations/cost"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_profile"] is True

    @pytest.mark.asyncio
    async def test_generate_with_items_to_analyze_insufficient_credits(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
        test_system_profile: UserSystemProfile,
    ):
        """Test generating recommendations when user has insufficient credits."""
        # Set user credits to 1 (need 2 for 100 items)
        test_user.credit_balance = 0
        test_user.free_credits_remaining = 1
        await async_session.commit()

        response = await authenticated_client.post(
            "/api/v1/profile/recommendations/generate",
            json={"max_recommendations": 5, "items_to_analyze": 100},
        )
        assert response.status_code == 402
        assert "insufficient credits" in response.json()["detail"].lower()


class TestAuthenticationRequired:
    """Tests for authentication requirements."""

    @pytest.mark.asyncio
    async def test_profile_requires_auth(self, unauthenticated_client: AsyncClient):
        """Test that profile endpoints require authentication."""
        response = await unauthenticated_client.get("/api/v1/profile/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_recommendations_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that recommendations endpoints require authentication."""
        response = await unauthenticated_client.get("/api/v1/profile/recommendations")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_recommendations_cost_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that recommendations cost endpoint requires authentication."""
        response = await unauthenticated_client.get(
            "/api/v1/profile/recommendations/cost"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_recommendations_generate_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that recommendations generate endpoint requires authentication."""
        response = await unauthenticated_client.post(
            "/api/v1/profile/recommendations/generate",
            json={"max_recommendations": 10},
        )
        assert response.status_code == 401
