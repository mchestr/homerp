from pydantic import BaseModel

from src.users.schemas import UserResponse


class TokenResponse(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    """Schema for authentication response with user info."""

    token: TokenResponse
    user: UserResponse


class OAuthCallbackParams(BaseModel):
    """Schema for OAuth callback parameters."""

    code: str
    state: str | None = None
