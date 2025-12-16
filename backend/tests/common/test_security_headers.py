"""Tests for security headers middleware."""

from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestSecurityHeaders:
    """Test that security headers are added to responses."""

    def test_x_content_type_options_header(self, client: TestClient):
        """X-Content-Type-Options header should be set to nosniff."""
        response = client.get("/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_frame_options_header(self, client: TestClient):
        """X-Frame-Options header should be set to SAMEORIGIN."""
        response = client.get("/health")
        assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"

    def test_x_xss_protection_header(self, client: TestClient):
        """X-XSS-Protection header should be set."""
        response = client.get("/health")
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_referrer_policy_header(self, client: TestClient):
        """Referrer-Policy header should be set."""
        response = client.get("/health")
        assert (
            response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        )

    def test_permissions_policy_header(self, client: TestClient):
        """Permissions-Policy header should restrict dangerous features."""
        response = client.get("/health")
        permissions = response.headers.get("Permissions-Policy")
        assert permissions is not None
        assert "camera=()" in permissions
        assert "microphone=()" in permissions
        assert "geolocation=()" in permissions

    def test_content_security_policy_header(self, client: TestClient):
        """Content-Security-Policy header should be set."""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "frame-ancestors 'self'" in csp

    def test_security_headers_on_api_endpoints_unauthenticated(
        self, client: TestClient
    ):
        """Security headers should be present on API endpoints (unauthenticated)."""
        response = client.get("/api/v1/items")
        # Unauthenticated request returns 401 but should have security headers
        assert response.status_code == 401
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"

    async def test_security_headers_on_authenticated_endpoints(
        self, authenticated_client: AsyncClient
    ):
        """Security headers should be present on authenticated endpoints."""
        response = await authenticated_client.get("/api/v1/items")
        assert response.status_code == 200
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"


class TestSecurityHeadersUnit:
    """Unit tests for security headers middleware."""

    def test_middleware_import(self):
        """SecurityHeadersMiddleware should be importable."""
        from src.common.security_headers import SecurityHeadersMiddleware

        assert SecurityHeadersMiddleware is not None

    def test_strict_middleware_import(self):
        """StrictSecurityHeadersMiddleware should be importable."""
        from src.common.security_headers import StrictSecurityHeadersMiddleware

        assert StrictSecurityHeadersMiddleware is not None
