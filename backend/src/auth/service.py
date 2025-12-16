from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt

from src.common.crypto_utils import constant_time_compare
from src.config import Settings, get_settings

IMAGE_TOKEN_EXPIRY_MINUTES = 60
LOCATION_TOKEN_EXPIRY_MINUTES = 60


class AuthService:
    """Service for authentication operations."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def create_image_token(self, user_id: UUID, image_id: UUID) -> str:
        """
        Create a short-lived token for accessing a specific image.

        This token is used for browser image loading where Authorization
        headers cannot be sent.
        """
        expire = datetime.now(UTC) + timedelta(minutes=IMAGE_TOKEN_EXPIRY_MINUTES)

        to_encode = {
            "sub": str(user_id),
            "image_id": str(image_id),
            "type": "image",
            "exp": expire,
            "iat": datetime.now(UTC),
        }

        return jwt.encode(
            to_encode,
            self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
        )

    def verify_image_token(self, token: str, image_id: UUID) -> UUID | None:
        """
        Verify an image access token and return the user ID.

        Returns:
            User ID if token is valid and matches the image_id, None otherwise.
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=[self.settings.jwt_algorithm],
            )
            # Verify this is an image token (use constant-time comparison)
            token_type = payload.get("type") or ""
            if not constant_time_compare(token_type, "image"):
                return None
            # Verify it's for the correct image (use constant-time comparison)
            token_image_id = payload.get("image_id") or ""
            if not constant_time_compare(token_image_id, str(image_id)):
                return None
            user_id_str: str | None = payload.get("sub")
            if user_id_str is None:
                return None
            return UUID(user_id_str)
        except (JWTError, ValueError):
            return None

    def create_location_token(self, user_id: UUID, location_id: UUID) -> str:
        """
        Create a short-lived token for accessing a specific location's QR code.

        This token is used for browser image loading where Authorization
        headers cannot be sent (e.g., <img src="...">).
        """
        expire = datetime.now(UTC) + timedelta(minutes=LOCATION_TOKEN_EXPIRY_MINUTES)

        to_encode = {
            "sub": str(user_id),
            "location_id": str(location_id),
            "type": "location",
            "exp": expire,
            "iat": datetime.now(UTC),
        }

        return jwt.encode(
            to_encode,
            self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
        )

    def verify_location_token(self, token: str, location_id: UUID) -> UUID | None:
        """
        Verify a location access token and return the user ID.

        Returns:
            User ID if token is valid and matches the location_id, None otherwise.
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=[self.settings.jwt_algorithm],
            )
            # Verify this is a location token (use constant-time comparison)
            token_type = payload.get("type") or ""
            if not constant_time_compare(token_type, "location"):
                return None
            # Verify it's for the correct location (use constant-time comparison)
            token_location_id = payload.get("location_id") or ""
            if not constant_time_compare(token_location_id, str(location_id)):
                return None
            user_id_str: str | None = payload.get("sub")
            if user_id_str is None:
                return None
            return UUID(user_id_str)
        except (JWTError, ValueError):
            return None

    def create_access_token(self, user_id: UUID) -> tuple[str, int]:
        """
        Create a JWT access token for a user.

        Returns:
            Tuple of (token, expires_in_seconds)
        """
        expires_delta = timedelta(hours=self.settings.jwt_expiration_hours)
        expire = datetime.now(UTC) + expires_delta

        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(UTC),
        }

        token = jwt.encode(
            to_encode,
            self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
        )

        expires_in = int(expires_delta.total_seconds())
        return token, expires_in

    def verify_token(self, token: str) -> UUID | None:
        """
        Verify a JWT token and return the user ID.

        Returns:
            User ID if token is valid, None otherwise.
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=[self.settings.jwt_algorithm],
            )
            user_id_str: str | None = payload.get("sub")
            if user_id_str is None:
                return None
            return UUID(user_id_str)
        except (JWTError, ValueError):
            return None


def get_auth_service() -> AuthService:
    """Get auth service instance."""
    return AuthService()
