"""HTTP integration tests for auth router."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from src.auth.oauth import OAuthUserInfo
from src.users.models import User


class TestGoogleAuthEndpoint:
    """Tests for GET /api/v1/auth/google."""

    async def test_get_oauth_url(self, authenticated_client: AsyncClient):
        """Test getting Google OAuth authorization URL."""
        response = await authenticated_client.get(
            "/api/v1/auth/google",
            params={"redirect_uri": "http://localhost:3000/callback"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "authorization_url" in data
        assert "accounts.google.com" in data["authorization_url"]

    async def test_get_oauth_url_missing_redirect_uri(
        self, authenticated_client: AsyncClient
    ):
        """Test that missing redirect_uri returns 422."""
        response = await authenticated_client.get("/api/v1/auth/google")

        assert response.status_code == 422


class TestGoogleCallbackEndpoint:
    """Tests for GET /api/v1/auth/callback/google."""

    async def test_oauth_callback_success(self, authenticated_client: AsyncClient):
        """Test successful OAuth callback."""
        with (
            patch(
                "src.auth.router.GoogleOAuth.exchange_code",
                new_callable=AsyncMock,
            ) as mock_exchange,
            patch(
                "src.auth.router.GoogleOAuth.get_user_info",
                new_callable=AsyncMock,
            ) as mock_user_info,
        ):
            mock_exchange.return_value = "mock_access_token"
            mock_user_info.return_value = OAuthUserInfo(
                provider="google",
                oauth_id="google_new_123",
                email="newuser@example.com",
                name="New User",
                avatar_url="https://example.com/avatar.jpg",
            )

            response = await authenticated_client.get(
                "/api/v1/auth/callback/google",
                params={
                    "code": "test_code",
                    "redirect_uri": "http://localhost:3000/callback",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["token"]["access_token"] is not None
            assert data["token"]["expires_in"] > 0

    async def test_oauth_callback_invalid_code(self, authenticated_client: AsyncClient):
        """Test OAuth callback with invalid code."""
        with patch(
            "src.auth.router.GoogleOAuth.exchange_code",
            new_callable=AsyncMock,
            side_effect=Exception("Invalid code"),
        ):
            response = await authenticated_client.get(
                "/api/v1/auth/callback/google",
                params={
                    "code": "invalid_code",
                    "redirect_uri": "http://localhost:3000/callback",
                },
            )

            assert response.status_code == 400
            assert "OAuth authentication failed" in response.json()["detail"]


class TestGetCurrentUserEndpoint:
    """Tests for GET /api/v1/auth/me."""

    async def test_get_current_user(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test getting current user information."""
        response = await authenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    async def test_get_current_user_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 401


class TestRefreshTokenEndpoint:
    """Tests for POST /api/v1/auth/refresh."""

    async def test_refresh_token(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test refreshing access token."""
        response = await authenticated_client.post("/api/v1/auth/refresh")

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "expires_in" in data
        assert data["expires_in"] > 0

    async def test_refresh_token_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post("/api/v1/auth/refresh")

        assert response.status_code == 401


class TestUpdateSettingsEndpoint:
    """Tests for PATCH /api/v1/auth/settings."""

    async def test_update_settings(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test updating user settings."""
        response = await authenticated_client.patch(
            "/api/v1/auth/settings",
            json={"language": "en"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "en"

    async def test_update_settings_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.patch(
            "/api/v1/auth/settings",
            json={"low_stock_threshold": 10},
        )

        assert response.status_code == 401
