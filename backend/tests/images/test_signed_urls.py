"""Tests for image signed URL functionality."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from src.auth.service import AuthService, IMAGE_TOKEN_EXPIRY_MINUTES
from src.config import Settings


@pytest.fixture
def auth_service(test_settings: Settings) -> AuthService:
    """Create an AuthService with test settings."""
    return AuthService(settings=test_settings)


class TestImageTokenCreation:
    """Tests for image token creation."""

    def test_create_image_token_returns_string(self, auth_service: AuthService):
        """Test that create_image_token returns a non-empty string."""
        user_id = uuid.uuid4()
        image_id = uuid.uuid4()

        token = auth_service.create_image_token(user_id, image_id)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_image_token_different_for_different_images(
        self, auth_service: AuthService
    ):
        """Test that different images get different tokens."""
        user_id = uuid.uuid4()
        image_id_1 = uuid.uuid4()
        image_id_2 = uuid.uuid4()

        token_1 = auth_service.create_image_token(user_id, image_id_1)
        token_2 = auth_service.create_image_token(user_id, image_id_2)

        assert token_1 != token_2

    def test_create_image_token_different_for_different_users(
        self, auth_service: AuthService
    ):
        """Test that different users get different tokens for the same image."""
        user_id_1 = uuid.uuid4()
        user_id_2 = uuid.uuid4()
        image_id = uuid.uuid4()

        token_1 = auth_service.create_image_token(user_id_1, image_id)
        token_2 = auth_service.create_image_token(user_id_2, image_id)

        assert token_1 != token_2


class TestImageTokenVerification:
    """Tests for image token verification."""

    def test_verify_valid_token_returns_user_id(self, auth_service: AuthService):
        """Test that verifying a valid token returns the user ID."""
        user_id = uuid.uuid4()
        image_id = uuid.uuid4()

        token = auth_service.create_image_token(user_id, image_id)
        result = auth_service.verify_image_token(token, image_id)

        assert result == user_id

    def test_verify_token_wrong_image_returns_none(self, auth_service: AuthService):
        """Test that verifying a token for the wrong image returns None."""
        user_id = uuid.uuid4()
        image_id = uuid.uuid4()
        wrong_image_id = uuid.uuid4()

        token = auth_service.create_image_token(user_id, image_id)
        result = auth_service.verify_image_token(token, wrong_image_id)

        assert result is None

    def test_verify_invalid_token_returns_none(self, auth_service: AuthService):
        """Test that verifying an invalid token returns None."""
        image_id = uuid.uuid4()

        result = auth_service.verify_image_token("invalid-token", image_id)

        assert result is None

    def test_verify_empty_token_returns_none(self, auth_service: AuthService):
        """Test that verifying an empty token returns None."""
        image_id = uuid.uuid4()

        result = auth_service.verify_image_token("", image_id)

        assert result is None

    def test_verify_regular_access_token_returns_none(self, auth_service: AuthService):
        """Test that a regular access token cannot be used as an image token."""
        user_id = uuid.uuid4()
        image_id = uuid.uuid4()

        # Create a regular access token (not an image token)
        access_token, _ = auth_service.create_access_token(user_id)

        # Try to use it as an image token - should fail
        result = auth_service.verify_image_token(access_token, image_id)

        assert result is None

    def test_verify_token_with_tampered_image_id_returns_none(
        self, auth_service: AuthService
    ):
        """Test that a token with a tampered image ID fails verification."""
        user_id = uuid.uuid4()
        image_id = uuid.uuid4()
        different_image_id = uuid.uuid4()

        token = auth_service.create_image_token(user_id, image_id)

        # Try to verify with a different image ID
        result = auth_service.verify_image_token(token, different_image_id)

        assert result is None


class TestImageTokenExpiry:
    """Tests for image token expiration."""

    def test_token_expiry_constant_is_reasonable(self):
        """Test that the token expiry is set to a reasonable value."""
        # Token should expire within a reasonable timeframe (1-120 minutes)
        assert 1 <= IMAGE_TOKEN_EXPIRY_MINUTES <= 120

    def test_token_contains_expiry(self, auth_service: AuthService):
        """Test that the token is created with an expiration time."""
        from jose import jwt

        user_id = uuid.uuid4()
        image_id = uuid.uuid4()

        token = auth_service.create_image_token(user_id, image_id)

        # Decode without verification to check the payload
        payload = jwt.decode(
            token,
            auth_service.settings.jwt_secret,
            algorithms=[auth_service.settings.jwt_algorithm],
        )

        assert "exp" in payload
        assert "iat" in payload

        # Verify expiry is in the future
        exp_time = datetime.fromtimestamp(payload["exp"], tz=UTC)
        now = datetime.now(UTC)
        assert exp_time > now

        # Verify expiry is approximately IMAGE_TOKEN_EXPIRY_MINUTES from now
        expected_expiry = now + timedelta(minutes=IMAGE_TOKEN_EXPIRY_MINUTES)
        # Allow 5 seconds tolerance
        assert abs((exp_time - expected_expiry).total_seconds()) < 5
