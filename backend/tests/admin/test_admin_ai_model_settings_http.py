"""HTTP integration tests for admin AI model settings endpoints."""

import uuid

from httpx import AsyncClient

from src.ai.models import AIModelSettings


class TestListAIModelSettingsEndpoint:
    """Tests for GET /api/v1/admin/ai-model-settings."""

    async def test_list_settings_as_admin(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test listing AI model settings as admin."""
        response = await admin_client.get("/api/v1/admin/ai-model-settings")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4  # 4 operation types

        # Check that all expected operation types are present
        operation_types = {s["operation_type"] for s in data}
        assert "image_classification" in operation_types
        assert "location_analysis" in operation_types
        assert "location_suggestion" in operation_types
        assert "assistant_query" in operation_types

    async def test_list_settings_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/ai-model-settings")

        assert response.status_code == 403

    async def test_list_settings_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/admin/ai-model-settings")

        assert response.status_code == 401

    async def test_list_settings_response_structure(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that response has expected structure."""
        response = await admin_client.get("/api/v1/admin/ai-model-settings")

        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

        # Check first settings has expected fields
        settings = data[0]
        assert "id" in settings
        assert "operation_type" in settings
        assert "model_name" in settings
        assert "temperature" in settings
        assert "max_tokens" in settings
        assert "display_name" in settings
        assert "description" in settings
        assert "is_active" in settings
        assert "created_at" in settings
        assert "updated_at" in settings


class TestGetAIModelSettingsEndpoint:
    """Tests for GET /api/v1/admin/ai-model-settings/{settings_id}."""

    async def test_get_settings_as_admin(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test getting specific AI model settings as admin."""
        settings = ai_model_settings[0]
        response = await admin_client.get(
            f"/api/v1/admin/ai-model-settings/{settings.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(settings.id)
        assert data["operation_type"] == settings.operation_type
        assert data["model_name"] == settings.model_name

    async def test_get_settings_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent settings."""
        response = await admin_client.get(
            f"/api/v1/admin/ai-model-settings/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    async def test_get_settings_as_non_admin(
        self,
        authenticated_client: AsyncClient,
        ai_model_settings: list[AIModelSettings],
    ):
        """Test that non-admin gets 403."""
        settings = ai_model_settings[0]
        response = await authenticated_client.get(
            f"/api/v1/admin/ai-model-settings/{settings.id}"
        )

        assert response.status_code == 403

    async def test_get_settings_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
        ai_model_settings: list[AIModelSettings],
    ):
        """Test that unauthenticated request returns 401."""
        settings = ai_model_settings[0]
        response = await unauthenticated_client.get(
            f"/api/v1/admin/ai-model-settings/{settings.id}"
        )

        assert response.status_code == 401


class TestUpdateAIModelSettingsEndpoint:
    """Tests for PUT /api/v1/admin/ai-model-settings/{settings_id}."""

    async def test_update_settings_model_name(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating model name."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"model_name": "gpt-4o-mini"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model_name"] == "gpt-4o-mini"

    async def test_update_settings_temperature(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating temperature."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"temperature": 0.7},
        )

        assert response.status_code == 200
        data = response.json()
        assert float(data["temperature"]) == 0.7

    async def test_update_settings_max_tokens(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating max_tokens."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"max_tokens": 1500},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["max_tokens"] == 1500

    async def test_update_settings_is_active(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating is_active status."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    async def test_update_settings_multiple_fields(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating multiple fields at once."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={
                "model_name": "gpt-4o-mini",
                "temperature": 0.5,
                "max_tokens": 2000,
                "display_name": "Updated Display Name",
                "description": "Updated description",
                "is_active": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model_name"] == "gpt-4o-mini"
        assert float(data["temperature"]) == 0.5
        assert data["max_tokens"] == 2000
        assert data["display_name"] == "Updated Display Name"
        assert data["description"] == "Updated description"
        assert data["is_active"] is True

    async def test_update_settings_invalid_temperature_too_low(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature < 0 is rejected by Pydantic validation."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"temperature": -0.1},
        )

        assert response.status_code == 422  # Pydantic validation error

    async def test_update_settings_invalid_temperature_too_high(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature > 2 is rejected by Pydantic validation."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"temperature": 2.1},
        )

        assert response.status_code == 422  # Pydantic validation error

    async def test_update_settings_invalid_max_tokens_too_low(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens < 1 is rejected by Pydantic validation."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"max_tokens": 0},
        )

        assert response.status_code == 422  # Pydantic validation error

    async def test_update_settings_invalid_max_tokens_too_high(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens > 100000 is rejected by Pydantic validation."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"max_tokens": 100001},
        )

        assert response.status_code == 422  # Pydantic validation error

    async def test_update_settings_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent settings."""
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{uuid.uuid4()}",
            json={"model_name": "test"},
        )

        assert response.status_code == 404

    async def test_update_settings_as_non_admin(
        self,
        authenticated_client: AsyncClient,
        ai_model_settings: list[AIModelSettings],
    ):
        """Test that non-admin gets 403."""
        settings = ai_model_settings[0]
        response = await authenticated_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"model_name": "test"},
        )

        assert response.status_code == 403

    async def test_update_settings_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
        ai_model_settings: list[AIModelSettings],
    ):
        """Test that unauthenticated request returns 401."""
        settings = ai_model_settings[0]
        response = await unauthenticated_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"model_name": "test"},
        )

        assert response.status_code == 401

    async def test_update_settings_boundary_temperature_zero(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature = 0 is accepted."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"temperature": 0.0},
        )

        assert response.status_code == 200
        data = response.json()
        assert float(data["temperature"]) == 0.0

    async def test_update_settings_boundary_temperature_two(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature = 2 is accepted."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"temperature": 2.0},
        )

        assert response.status_code == 200
        data = response.json()
        assert float(data["temperature"]) == 2.0

    async def test_update_settings_boundary_max_tokens_one(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens = 1 is accepted."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"max_tokens": 1},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["max_tokens"] == 1

    async def test_update_settings_boundary_max_tokens_max(
        self, admin_client: AsyncClient, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens = 100000 is accepted."""
        settings = ai_model_settings[0]
        response = await admin_client.put(
            f"/api/v1/admin/ai-model-settings/{settings.id}",
            json={"max_tokens": 100000},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["max_tokens"] == 100000
