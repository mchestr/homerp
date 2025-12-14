"""API Key schemas for request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# Available scopes for API keys
VALID_SCOPES = [
    "feedback:read",
    "feedback:write",
    "admin:*",
]


class ApiKeyCreate(BaseModel):
    """Schema for creating an API key."""

    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None


class ApiKeyResponse(BaseModel):
    """Schema for API key response (without the actual key)."""

    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(BaseModel):
    """Schema for API key creation response (includes the full key, shown only once)."""

    id: UUID
    name: str
    key: str  # The full API key, shown only once
    key_prefix: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    expires_at: datetime | None


class ApiKeyUpdate(BaseModel):
    """Schema for updating an API key."""

    name: str | None = Field(None, min_length=1, max_length=255)
    scopes: list[str] | None = None
    is_active: bool | None = None


class PaginatedApiKeyResponse(BaseModel):
    """Paginated response for API keys."""

    items: list[ApiKeyResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[ApiKeyResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedApiKeyResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )
