"""API Key management routes (admin only)."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.apikeys.repository import ApiKeyRepository
from src.apikeys.schemas import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    ApiKeyUpdate,
    PaginatedApiKeyResponse,
)
from src.apikeys.service import ApiKeyService
from src.auth.dependencies import AdminUserDep
from src.database import AsyncSessionDep

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreate,
    session: AsyncSessionDep,
    admin: AdminUserDep,
) -> ApiKeyCreatedResponse:
    """
    Create a new API key (admin only).

    The full API key is only returned once in this response.
    Store it securely as it cannot be retrieved again.
    """
    service = ApiKeyService(session)
    api_key, raw_key = await service.create_key(
        user_id=admin.id,
        name=data.name,
        scopes=data.scopes,
        expires_at=data.expires_at,
    )

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
    )


@router.get("")
async def list_api_keys(
    session: AsyncSessionDep,
    admin: AdminUserDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedApiKeyResponse:
    """List all API keys for the current admin (paginated)."""
    repo = ApiKeyRepository(session)
    offset = (page - 1) * limit

    keys = await repo.get_user_keys(admin.id, offset=offset, limit=limit)
    total = await repo.count_user_keys(admin.id)

    items = [ApiKeyResponse.model_validate(k) for k in keys]
    return PaginatedApiKeyResponse.create(items, total, page, limit)


@router.get("/{api_key_id}")
async def get_api_key(
    api_key_id: UUID,
    session: AsyncSessionDep,
    admin: AdminUserDep,
) -> ApiKeyResponse:
    """Get details of a specific API key."""
    repo = ApiKeyRepository(session)
    api_key = await repo.get_by_id(api_key_id)

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    # Ensure the key belongs to this admin
    if api_key.user_id != admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return ApiKeyResponse.model_validate(api_key)


@router.patch("/{api_key_id}")
async def update_api_key(
    api_key_id: UUID,
    data: ApiKeyUpdate,
    session: AsyncSessionDep,
    admin: AdminUserDep,
) -> ApiKeyResponse:
    """Update an API key (name, scopes, or active status)."""
    repo = ApiKeyRepository(session)
    api_key = await repo.get_by_id(api_key_id)

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    # Ensure the key belongs to this admin
    if api_key.user_id != admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Validate scopes if provided
    if data.scopes is not None:
        from src.apikeys.schemas import VALID_SCOPES

        data.scopes = [s for s in data.scopes if s in VALID_SCOPES]

    api_key = await repo.update(api_key, data)
    return ApiKeyResponse.model_validate(api_key)


@router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    api_key_id: UUID,
    session: AsyncSessionDep,
    admin: AdminUserDep,
) -> None:
    """Delete (revoke) an API key."""
    repo = ApiKeyRepository(session)
    api_key = await repo.get_by_id(api_key_id)

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    # Ensure the key belongs to this admin
    if api_key.user_id != admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    await repo.delete(api_key)
