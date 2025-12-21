"""HTTP integration tests for admin billing settings endpoints."""

import uuid

from httpx import AsyncClient

from src.billing.models import AppSetting


class TestListBillingSettingsEndpoint:
    """Tests for GET /api/v1/admin/billing-settings."""

    async def test_list_settings_as_admin(
        self, admin_client: AsyncClient, app_settings: list[AppSetting]
    ):
        """Test listing billing settings as admin."""
        response = await admin_client.get("/api/v1/admin/billing-settings")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2  # 2 settings from fixture

        # Check that all expected setting keys are present
        setting_keys = {s["setting_key"] for s in data}
        assert "signup_credits" in setting_keys
        assert "max_images_per_item" in setting_keys

    async def test_list_settings_empty(self, admin_client: AsyncClient):
        """Test listing settings when none exist."""
        response = await admin_client.get("/api/v1/admin/billing-settings")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    async def test_list_settings_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/billing-settings")

        assert response.status_code == 403

    async def test_list_settings_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/admin/billing-settings")

        assert response.status_code == 401

    async def test_list_settings_response_structure(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test that response has expected structure."""
        response = await admin_client.get("/api/v1/admin/billing-settings")

        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

        # Check first setting has expected fields
        setting = data[0]
        assert "id" in setting
        assert "setting_key" in setting
        assert "value_int" in setting
        assert "display_name" in setting
        assert "description" in setting
        assert "created_at" in setting
        assert "updated_at" in setting


class TestGetBillingSettingEndpoint:
    """Tests for GET /api/v1/admin/billing-settings/{setting_id}."""

    async def test_get_setting_as_admin(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test getting specific billing setting as admin."""
        response = await admin_client.get(
            f"/api/v1/admin/billing-settings/{app_setting.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(app_setting.id)
        assert data["setting_key"] == app_setting.setting_key
        assert data["value_int"] == app_setting.value_int

    async def test_get_setting_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent setting."""
        response = await admin_client.get(
            f"/api/v1/admin/billing-settings/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    async def test_get_setting_as_non_admin(
        self,
        authenticated_client: AsyncClient,
        app_setting: AppSetting,
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get(
            f"/api/v1/admin/billing-settings/{app_setting.id}"
        )

        assert response.status_code == 403

    async def test_get_setting_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
        app_setting: AppSetting,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get(
            f"/api/v1/admin/billing-settings/{app_setting.id}"
        )

        assert response.status_code == 401


class TestUpdateBillingSettingEndpoint:
    """Tests for PUT /api/v1/admin/billing-settings/{setting_id}."""

    async def test_update_setting_value(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test updating setting value."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["value_int"] == 10

    async def test_update_setting_display_name(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test updating display name."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"display_name": "Updated Display Name"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "Updated Display Name"

    async def test_update_setting_description(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test updating description."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"description": "Updated description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description"

    async def test_update_setting_multiple_fields(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test updating multiple fields at once."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={
                "value_int": 15,
                "display_name": "New Name",
                "description": "New description",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["value_int"] == 15
        assert data["display_name"] == "New Name"
        assert data["description"] == "New description"

    async def test_update_setting_invalid_negative_value(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test that negative value_int is rejected."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": -1},
        )

        # Pydantic validation returns 422 for invalid values
        assert response.status_code == 422

    async def test_update_setting_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent setting."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{uuid.uuid4()}",
            json={"value_int": 10},
        )

        assert response.status_code == 404

    async def test_update_setting_as_non_admin(
        self,
        authenticated_client: AsyncClient,
        app_setting: AppSetting,
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": 10},
        )

        assert response.status_code == 403

    async def test_update_setting_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
        app_setting: AppSetting,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": 10},
        )

        assert response.status_code == 401

    async def test_update_setting_boundary_zero(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test that value_int = 0 is accepted."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": 0},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["value_int"] == 0

    async def test_update_setting_large_value(
        self, admin_client: AsyncClient, app_setting: AppSetting
    ):
        """Test that large value_int is accepted."""
        response = await admin_client.put(
            f"/api/v1/admin/billing-settings/{app_setting.id}",
            json={"value_int": 999999},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["value_int"] == 999999
