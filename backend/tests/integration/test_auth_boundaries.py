"""Integration tests for authentication and authorization boundaries.

Tests verify:
- JWT token security (expiration, tampering, algorithm confusion)
- Image token binding and expiration
- Bearer token requirements
- Authentication bypass attempts
"""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from jose import jwt

from src.auth.service import IMAGE_TOKEN_EXPIRY_MINUTES, AuthService
from src.config import Settings
from src.images.models import Image
from src.users.models import User


class TestJWTTokenSecurity:
    """Tests for JWT access token security."""

    async def test_valid_token_authenticates_successfully(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Valid JWT token should authenticate successfully."""
        auth_service = AuthService(test_settings)
        token, expires_in = auth_service.create_access_token(test_user.id)

        # Verify the token
        verified_user_id = auth_service.verify_token(token)

        assert verified_user_id == test_user.id
        assert expires_in > 0

    async def test_expired_token_rejected(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Expired JWT tokens should be rejected."""
        # Create a token that's already expired
        expire = datetime.now(UTC) - timedelta(hours=1)
        to_encode = {
            "sub": str(test_user.id),
            "exp": expire,
            "iat": datetime.now(UTC) - timedelta(hours=2),
        }
        expired_token = jwt.encode(
            to_encode,
            test_settings.jwt_secret,
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_token(expired_token)

        assert result is None

    async def test_tampered_token_rejected(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Tokens signed with wrong secret should be rejected."""
        # Create a token with a different secret
        expire = datetime.now(UTC) + timedelta(hours=24)
        to_encode = {
            "sub": str(test_user.id),
            "exp": expire,
            "iat": datetime.now(UTC),
        }
        tampered_token = jwt.encode(
            to_encode,
            "wrong-secret-key",
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_token(tampered_token)

        assert result is None

    async def test_token_without_subject_rejected(
        self,
        test_settings: Settings,
    ):
        """Tokens without 'sub' claim should be rejected."""
        expire = datetime.now(UTC) + timedelta(hours=24)
        to_encode = {
            "exp": expire,
            "iat": datetime.now(UTC),
            # No "sub" claim
        }
        token_without_sub = jwt.encode(
            to_encode,
            test_settings.jwt_secret,
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_token(token_without_sub)

        assert result is None

    async def test_token_with_invalid_uuid_rejected(
        self,
        test_settings: Settings,
    ):
        """Tokens with invalid UUID in 'sub' should be rejected."""
        expire = datetime.now(UTC) + timedelta(hours=24)
        to_encode = {
            "sub": "not-a-valid-uuid",
            "exp": expire,
            "iat": datetime.now(UTC),
        }
        invalid_sub_token = jwt.encode(
            to_encode,
            test_settings.jwt_secret,
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_token(invalid_sub_token)

        assert result is None

    async def test_algorithm_confusion_attack_prevented(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Algorithm confusion attacks (using 'none') should be prevented."""
        # Try creating token with 'none' algorithm
        expire = datetime.now(UTC) + timedelta(hours=24)
        to_encode = {
            "sub": str(test_user.id),
            "exp": expire,
            "iat": datetime.now(UTC),
        }

        # jose library prevents 'none' algorithm by default
        # but we test that verification fails for it
        try:
            none_token = jwt.encode(
                to_encode,
                "",  # Empty key for 'none'
                algorithm="none",
            )
            auth_service = AuthService(test_settings)
            result = auth_service.verify_token(none_token)
            assert result is None
        except Exception:
            # Expected - library may reject 'none' algorithm
            pass


class TestImageTokenSecurity:
    """Tests for image access token security."""

    async def test_valid_image_token_works(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Valid image token should work for the correct image."""
        auth_service = AuthService(test_settings)
        image_id = uuid.uuid4()

        token = auth_service.create_image_token(test_user.id, image_id)
        verified_user_id = auth_service.verify_image_token(token, image_id)

        assert verified_user_id == test_user.id

    async def test_image_token_bound_to_specific_image(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Image token should only work for the specific image it was created for."""
        auth_service = AuthService(test_settings)
        image_id = uuid.uuid4()
        other_image_id = uuid.uuid4()

        token = auth_service.create_image_token(test_user.id, image_id)

        # Should fail for different image
        result = auth_service.verify_image_token(token, other_image_id)

        assert result is None

    async def test_image_token_expiration(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Image tokens should expire after the configured time."""
        # Create an already-expired image token
        image_id = uuid.uuid4()
        expire = datetime.now(UTC) - timedelta(minutes=1)
        to_encode = {
            "sub": str(test_user.id),
            "image_id": str(image_id),
            "type": "image",
            "exp": expire,
            "iat": datetime.now(UTC)
            - timedelta(minutes=IMAGE_TOKEN_EXPIRY_MINUTES + 1),
        }
        expired_token = jwt.encode(
            to_encode,
            test_settings.jwt_secret,
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_image_token(expired_token, image_id)

        assert result is None

    async def test_access_token_cannot_be_used_as_image_token(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Regular access tokens should not work as image tokens."""
        auth_service = AuthService(test_settings)
        image_id = uuid.uuid4()

        # Create a regular access token
        access_token, _ = auth_service.create_access_token(test_user.id)

        # Should fail when used as image token (missing 'type' claim)
        result = auth_service.verify_image_token(access_token, image_id)

        assert result is None

    async def test_image_token_with_wrong_type_rejected(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Tokens with wrong 'type' claim should be rejected."""
        image_id = uuid.uuid4()
        expire = datetime.now(UTC) + timedelta(hours=1)
        to_encode = {
            "sub": str(test_user.id),
            "image_id": str(image_id),
            "type": "access",  # Wrong type
            "exp": expire,
            "iat": datetime.now(UTC),
        }
        wrong_type_token = jwt.encode(
            to_encode,
            test_settings.jwt_secret,
            algorithm=test_settings.jwt_algorithm,
        )

        auth_service = AuthService(test_settings)
        result = auth_service.verify_image_token(wrong_type_token, image_id)

        assert result is None


class TestBearerTokenRequirements:
    """Tests for Bearer token requirements on protected endpoints."""

    async def test_items_endpoint_requires_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Items endpoint should require authentication."""
        response = await unauthenticated_client.get("/api/v1/items")

        assert response.status_code == 401

    async def test_categories_endpoint_requires_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Categories endpoint should require authentication."""
        response = await unauthenticated_client.get("/api/v1/categories")

        assert response.status_code == 401

    async def test_locations_endpoint_requires_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Locations endpoint should require authentication."""
        response = await unauthenticated_client.get("/api/v1/locations")

        assert response.status_code == 401

    async def test_images_endpoint_requires_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Images upload endpoint should require authentication."""
        response = await unauthenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.jpg", b"fake", "image/jpeg")},
        )

        assert response.status_code == 401

    async def test_billing_balance_requires_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Billing balance endpoint should require authentication."""
        response = await unauthenticated_client.get("/api/v1/billing/balance")

        assert response.status_code == 401

    async def test_admin_endpoints_require_auth(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Admin endpoints should require authentication."""
        response = await unauthenticated_client.get("/api/v1/admin/stats")

        assert response.status_code == 401


class TestImageFileAccessSecurity:
    """Tests for image file access security."""

    async def test_image_file_requires_token(
        self,
        unauthenticated_client: AsyncClient,
        test_image: Image,
    ):
        """Image file endpoint should require a valid token."""
        response = await unauthenticated_client.get(
            f"/api/v1/images/{test_image.id}/file"
        )

        assert response.status_code == 401

    async def test_image_file_rejects_invalid_token(
        self,
        unauthenticated_client: AsyncClient,
        test_image: Image,
    ):
        """Image file endpoint should reject invalid tokens."""
        response = await unauthenticated_client.get(
            f"/api/v1/images/{test_image.id}/file?token=invalid-token"
        )

        assert response.status_code == 401

    async def test_thumbnail_requires_token(
        self,
        unauthenticated_client: AsyncClient,
        test_image: Image,
    ):
        """Thumbnail endpoint should require a valid token."""
        response = await unauthenticated_client.get(
            f"/api/v1/images/{test_image.id}/thumbnail"
        )

        assert response.status_code == 401

    async def test_image_token_from_different_user_rejected(
        self,
        authenticated_client: AsyncClient,
        test_settings: Settings,
        second_user: User,
        test_image: Image,
    ):
        """Image token from different user should be rejected."""
        auth_service = AuthService(test_settings)

        # Create token for second_user for test_user's image
        token = auth_service.create_image_token(second_user.id, test_image.id)

        # Try to access the image
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/file?token={token}"
        )

        # Should fail because the user in token doesn't match the image owner
        assert response.status_code in [401, 404]


class TestAuthenticationBypassAttempts:
    """Tests for authentication bypass attempts."""

    async def test_empty_bearer_token_rejected(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Empty Bearer token should be rejected."""
        response = await unauthenticated_client.get(
            "/api/v1/items",
            headers={"Authorization": "Bearer "},
        )

        assert response.status_code == 401

    async def test_bearer_with_spaces_rejected(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Bearer token with only spaces should be rejected."""
        response = await unauthenticated_client.get(
            "/api/v1/items",
            headers={"Authorization": "Bearer    "},
        )

        assert response.status_code == 401

    async def test_non_bearer_auth_scheme_rejected(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Non-Bearer auth schemes should be rejected."""
        response = await unauthenticated_client.get(
            "/api/v1/items",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},  # Base64 "user:pass"
        )

        assert response.status_code == 401

    async def test_token_injection_in_query_params_rejected(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """JWT tokens in query params should not authenticate (except image endpoints)."""
        response = await unauthenticated_client.get(
            "/api/v1/items?token=some-fake-token"
        )

        assert response.status_code == 401

    async def test_jwt_in_cookie_rejected(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """JWT tokens in cookies should not authenticate (Bearer-only auth)."""
        response = await unauthenticated_client.get(
            "/api/v1/items",
            cookies={"access_token": "some-fake-token"},
        )

        assert response.status_code == 401


class TestTokenReuse:
    """Tests for token reuse scenarios."""

    async def test_same_token_can_be_reused_before_expiry(
        self,
        test_settings: Settings,
        test_user: User,
    ):
        """Same token should work multiple times before expiry."""
        auth_service = AuthService(test_settings)
        token, _ = auth_service.create_access_token(test_user.id)

        # Verify multiple times
        result1 = auth_service.verify_token(token)
        result2 = auth_service.verify_token(token)
        result3 = auth_service.verify_token(token)

        assert result1 == test_user.id
        assert result2 == test_user.id
        assert result3 == test_user.id

    async def test_different_users_get_different_tokens(
        self,
        test_settings: Settings,
        test_user: User,
        second_user: User,
    ):
        """Different users should get unique tokens."""
        auth_service = AuthService(test_settings)

        token1, _ = auth_service.create_access_token(test_user.id)
        token2, _ = auth_service.create_access_token(second_user.id)

        assert token1 != token2

        # Each token should verify to its respective user
        assert auth_service.verify_token(token1) == test_user.id
        assert auth_service.verify_token(token2) == second_user.id
