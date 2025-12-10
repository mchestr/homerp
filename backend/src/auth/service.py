from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt

from src.config import Settings, get_settings


class AuthService:
    """Service for authentication operations."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

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
