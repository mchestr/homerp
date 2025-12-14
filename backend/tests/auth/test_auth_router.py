"""HTTP integration tests for auth router."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from src.auth.oauth import OAuthUserInfo
from src.users.models import User


class TestListProvidersEndpoint:
    """Tests for GET /api/v1/auth/providers."""

    async def test_list_providers_returns_configured(
        self, authenticated_client: AsyncClient
    ):
        """Test that only configured providers are returned."""
        with patch(
            "src.auth.router.get_configured_providers",
            return_value=["google", "github"],
        ):
            response = await authenticated_client.get("/api/v1/auth/providers")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["id"] == "google"
            assert data[0]["name"] == "Google"
            assert data[0]["icon"] == "google"
            assert data[1]["id"] == "github"
            assert data[1]["name"] == "GitHub"
            assert data[1]["icon"] == "github"

    async def test_list_providers_no_auth_required(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that the providers endpoint doesn't require authentication."""
        with patch(
            "src.auth.router.get_configured_providers",
            return_value=["google"],
        ):
            response = await unauthenticated_client.get("/api/v1/auth/providers")

            assert response.status_code == 200


class TestGetAuthUrlEndpoint:
    """Tests for GET /api/v1/auth/{provider}."""

    async def test_get_google_oauth_url(self, authenticated_client: AsyncClient):
        """Test getting Google OAuth authorization URL."""
        response = await authenticated_client.get(
            "/api/v1/auth/google",
            params={"redirect_uri": "http://localhost:3000/callback/google"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "authorization_url" in data
        assert "accounts.google.com" in data["authorization_url"]

    async def test_get_github_oauth_url_when_configured(
        self, authenticated_client: AsyncClient
    ):
        """Test getting GitHub OAuth authorization URL when configured."""
        with (
            patch("src.auth.oauth.GitHubOAuth.is_configured", True),
            patch(
                "src.auth.oauth.GitHubOAuth.client_id",
                new_callable=lambda: property(lambda _: "test-client-id"),
            ),
        ):
            response = await authenticated_client.get(
                "/api/v1/auth/github",
                params={"redirect_uri": "http://localhost:3000/callback/github"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "authorization_url" in data
            assert "github.com" in data["authorization_url"]

    async def test_get_oauth_url_unknown_provider(
        self, authenticated_client: AsyncClient
    ):
        """Test that unknown provider returns 400."""
        response = await authenticated_client.get(
            "/api/v1/auth/unknown",
            params={"redirect_uri": "http://localhost:3000/callback/unknown"},
        )

        assert response.status_code == 400
        assert "Unknown OAuth provider" in response.json()["detail"]

    async def test_get_oauth_url_missing_redirect_uri(
        self, authenticated_client: AsyncClient
    ):
        """Test that missing redirect_uri returns 422."""
        response = await authenticated_client.get("/api/v1/auth/google")

        assert response.status_code == 422

    async def test_get_oauth_url_unconfigured_provider(
        self, authenticated_client: AsyncClient
    ):
        """Test that unconfigured provider returns 400."""
        with patch("src.auth.oauth.GitHubOAuth.is_configured", False):
            response = await authenticated_client.get(
                "/api/v1/auth/github",
                params={"redirect_uri": "http://localhost:3000/callback/github"},
            )

            assert response.status_code == 400
            assert "not configured" in response.json()["detail"]


class TestOAuthCallbackEndpoint:
    """Tests for GET /api/v1/auth/callback/{provider}."""

    async def test_google_oauth_callback_success(
        self, authenticated_client: AsyncClient
    ):
        """Test successful Google OAuth callback."""
        with (
            patch(
                "src.auth.router.get_oauth_provider",
            ) as mock_get_provider,
        ):
            mock_provider = AsyncMock()
            mock_provider.is_configured = True
            mock_provider.exchange_code = AsyncMock(return_value="mock_access_token")
            mock_provider.get_user_info = AsyncMock(
                return_value=OAuthUserInfo(
                    provider="google",
                    oauth_id="google_new_123",
                    email="newuser@example.com",
                    name="New User",
                    avatar_url="https://example.com/avatar.jpg",
                )
            )
            mock_get_provider.return_value = mock_provider

            response = await authenticated_client.get(
                "/api/v1/auth/callback/google",
                params={
                    "code": "test_code",
                    "redirect_uri": "http://localhost:3000/callback/google",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["token"]["access_token"] is not None
            assert data["token"]["expires_in"] > 0

    async def test_github_oauth_callback_success(
        self, authenticated_client: AsyncClient
    ):
        """Test successful GitHub OAuth callback."""
        with (
            patch(
                "src.auth.router.get_oauth_provider",
            ) as mock_get_provider,
        ):
            mock_provider = AsyncMock()
            mock_provider.is_configured = True
            mock_provider.exchange_code = AsyncMock(return_value="mock_access_token")
            mock_provider.get_user_info = AsyncMock(
                return_value=OAuthUserInfo(
                    provider="github",
                    oauth_id="github_456",
                    email="githubuser@example.com",
                    name="GitHub User",
                    avatar_url="https://github.com/avatar.jpg",
                )
            )
            mock_get_provider.return_value = mock_provider

            response = await authenticated_client.get(
                "/api/v1/auth/callback/github",
                params={
                    "code": "test_code",
                    "redirect_uri": "http://localhost:3000/callback/github",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["email"] == "githubuser@example.com"

    async def test_oauth_callback_invalid_code(self, authenticated_client: AsyncClient):
        """Test OAuth callback with invalid code."""
        with patch(
            "src.auth.router.get_oauth_provider",
        ) as mock_get_provider:
            mock_provider = AsyncMock()
            mock_provider.is_configured = True
            mock_provider.exchange_code = AsyncMock(
                side_effect=Exception("Invalid code")
            )
            mock_get_provider.return_value = mock_provider

            response = await authenticated_client.get(
                "/api/v1/auth/callback/google",
                params={
                    "code": "invalid_code",
                    "redirect_uri": "http://localhost:3000/callback/google",
                },
            )

            assert response.status_code == 400
            assert "OAuth authentication failed" in response.json()["detail"]

    async def test_oauth_callback_unknown_provider(
        self, authenticated_client: AsyncClient
    ):
        """Test OAuth callback with unknown provider."""
        response = await authenticated_client.get(
            "/api/v1/auth/callback/unknown",
            params={
                "code": "test_code",
                "redirect_uri": "http://localhost:3000/callback/unknown",
            },
        )

        assert response.status_code == 400
        assert "Unknown OAuth provider" in response.json()["detail"]


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
