"""HTTP integration tests for webhooks router."""

import uuid

from httpx import AsyncClient

from src.webhooks.models import WebhookConfig


class TestListEventTypesEndpoint:
    """Tests for GET /api/v1/webhooks/event-types."""

    async def test_list_event_types_as_admin(self, admin_client: AsyncClient):
        """Test listing event types as admin."""
        response = await admin_client.get("/api/v1/webhooks/event-types")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "value" in data[0]  # EventTypeInfo has 'value' not 'event_type'

    async def test_list_event_types_as_non_admin(
        self, authenticated_client: AsyncClient
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/webhooks/event-types")

        assert response.status_code == 403

    async def test_list_event_types_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/webhooks/event-types")

        assert response.status_code == 401


class TestListConfigsEndpoint:
    """Tests for GET /api/v1/webhooks/configs."""

    async def test_list_configs_as_admin(
        self, admin_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test listing webhook configs as admin."""
        response = await admin_client.get("/api/v1/webhooks/configs")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_configs_as_non_admin(
        self, authenticated_client: AsyncClient
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/webhooks/configs")

        assert response.status_code == 403


class TestCreateConfigEndpoint:
    """Tests for POST /api/v1/webhooks/configs."""

    async def test_create_config_as_admin(self, admin_client: AsyncClient):
        """Test creating webhook config as admin."""
        response = await admin_client.post(
            "/api/v1/webhooks/configs",
            json={
                "url": "https://webhook.example.com/new",
                "event_type": "item.created",
                "http_method": "POST",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["event_type"] == "item.created"
        assert data["url"] == "https://webhook.example.com/new"

    async def test_create_config_duplicate_event_type(
        self, admin_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test creating config with duplicate event type."""
        response = await admin_client.post(
            "/api/v1/webhooks/configs",
            json={
                "name": "Duplicate Webhook",
                "url": "https://webhook.example.com/dup",
                "event_type": test_webhook_config.event_type,
                "http_method": "POST",
            },
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    async def test_create_config_as_non_admin(
        self, authenticated_client: AsyncClient
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.post(
            "/api/v1/webhooks/configs",
            json={
                "name": "Test",
                "url": "https://test.com",
                "event_type": "test",
                "http_method": "POST",
            },
        )

        assert response.status_code == 403


class TestGetConfigEndpoint:
    """Tests for GET /api/v1/webhooks/configs/{config_id}."""

    async def test_get_config_as_admin(
        self, admin_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test getting webhook config as admin."""
        response = await admin_client.get(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_webhook_config.id)
        assert data["event_type"] == test_webhook_config.event_type

    async def test_get_config_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent config."""
        response = await admin_client.get(
            f"/api/v1/webhooks/configs/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    async def test_get_config_as_non_admin(
        self, authenticated_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}"
        )

        assert response.status_code == 403


class TestUpdateConfigEndpoint:
    """Tests for PUT /api/v1/webhooks/configs/{config_id}."""

    async def test_update_config_as_admin(
        self, admin_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test updating webhook config as admin."""
        response = await admin_client.put(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}",
            json={
                "is_active": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    async def test_update_config_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent config."""
        response = await admin_client.put(
            f"/api/v1/webhooks/configs/{uuid.uuid4()}",
            json={"name": "Test"},
        )

        assert response.status_code == 404

    async def test_update_config_as_non_admin(
        self, authenticated_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.put(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}",
            json={"name": "Test"},
        )

        assert response.status_code == 403


class TestDeleteConfigEndpoint:
    """Tests for DELETE /api/v1/webhooks/configs/{config_id}."""

    async def test_delete_config_as_admin(
        self, admin_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test deleting webhook config as admin."""
        response = await admin_client.delete(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}"
        )

        assert response.status_code == 204

        # Verify config is deleted
        get_response = await admin_client.get(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}"
        )
        assert get_response.status_code == 404

    async def test_delete_config_not_found(self, admin_client: AsyncClient):
        """Test deleting non-existent config."""
        response = await admin_client.delete(
            f"/api/v1/webhooks/configs/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    async def test_delete_config_as_non_admin(
        self, authenticated_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.delete(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}"
        )

        assert response.status_code == 403


class TestTestConfigEndpoint:
    """Tests for POST /api/v1/webhooks/configs/{config_id}/test."""

    async def test_test_config_not_found(self, admin_client: AsyncClient):
        """Test testing non-existent config."""
        response = await admin_client.post(
            f"/api/v1/webhooks/configs/{uuid.uuid4()}/test",
            json={"test_payload": {}},
        )

        assert response.status_code == 404

    async def test_test_config_as_non_admin(
        self, authenticated_client: AsyncClient, test_webhook_config: WebhookConfig
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.post(
            f"/api/v1/webhooks/configs/{test_webhook_config.id}/test",
            json={"test_payload": {}},
        )

        assert response.status_code == 403


class TestListExecutionsEndpoint:
    """Tests for GET /api/v1/webhooks/executions."""

    async def test_list_executions_as_admin(self, admin_client: AsyncClient):
        """Test listing webhook executions as admin."""
        response = await admin_client.get("/api/v1/webhooks/executions")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_executions_as_non_admin(
        self, authenticated_client: AsyncClient
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/webhooks/executions")

        assert response.status_code == 403
