from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.apikeys.models import ApiKey
from src.apikeys.service import ApiKeyService
from src.auth.service import AuthService, get_auth_service
from src.database import AsyncSessionDep
from src.users.models import User
from src.users.repository import UserRepository

# HTTP Bearer token security (auto_error=False to allow API key fallback)
security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    session: AsyncSessionDep,
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> UUID:
    """
    Get the current user ID from the JWT token or API key.

    Supports both Bearer token and X-API-Key header authentication.
    Raises HTTPException if neither is valid.
    """
    # Try Bearer token first
    if credentials is not None:
        user_id = auth_service.verify_token(credentials.credentials)
        if user_id is not None:
            return user_id

    # Try API key
    if x_api_key is not None:
        api_key_service = ApiKeyService(session)
        api_key = await api_key_service.validate_key(x_api_key)
        if api_key is not None:
            return api_key.user_id

    # Neither worked
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    session: AsyncSessionDep,
) -> User:
    """
    Get the current user from the database.

    Raises HTTPException if user not found.
    """
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Type aliases for dependency injection
CurrentUserIdDep = Annotated[UUID, Depends(get_current_user_id)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def get_admin_user(
    user: CurrentUserDep,
) -> User:
    """
    Get the current user and verify they are an admin.

    Raises HTTPException 403 if user is not an admin.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


AdminUserDep = Annotated[User, Depends(get_admin_user)]


# API Key specific dependencies for scope-protected endpoints
async def get_api_key_from_header(
    session: AsyncSessionDep,
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> ApiKey | None:
    """
    Get the API key from the X-API-Key header if present.

    Returns None if no API key header or if the key is invalid.
    """
    if x_api_key is None:
        return None

    api_key_service = ApiKeyService(session)
    return await api_key_service.validate_key(x_api_key)


ApiKeyDep = Annotated[ApiKey | None, Depends(get_api_key_from_header)]


def require_scope(scope: str):
    """
    Dependency factory to require a specific scope for API key authentication.

    For Bearer token auth, this check is skipped (users have all permissions).
    For API key auth, the key must have the required scope.
    """

    async def check_scope(
        request: Request,
        api_key: ApiKeyDep,
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    ) -> None:
        # If authenticated via Bearer token, allow (users have full access)
        if credentials is not None:
            return

        # If authenticated via API key, check scope
        if api_key is not None:
            api_key_service = ApiKeyService(request.state.session)
            if api_key_service.has_scope(api_key, scope):
                return

        # No valid authentication with required scope
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required scope: {scope}",
        )

    return check_scope
