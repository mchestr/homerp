from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    name: str | None = None
    avatar_url: str | None = None


class UserCreate(UserBase):
    """Schema for creating a user (internal use)."""

    oauth_provider: str
    oauth_id: str


class UserResponse(UserBase):
    """Schema for user responses."""

    id: UUID
    is_admin: bool = False
    oauth_provider: str
    currency: str = "USD"
    language: str = "en"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings."""

    currency: str | None = None
    language: str | None = None
