"""Webhook schemas for request/response models."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field, HttpUrl

from src.common.header_validator import validate_headers
from src.common.url_validator import validate_webhook_url_sync

# Custom type that validates URLs for SSRF
SafeWebhookUrl = Annotated[
    HttpUrl, AfterValidator(lambda v: validate_webhook_url_sync(str(v)) and v)
]

# Custom type that validates headers for CRLF injection
SafeHeaders = Annotated[dict[str, str], AfterValidator(validate_headers)]

# Available event types with their template variables
AVAILABLE_EVENT_TYPES = [
    {
        "value": "feedback.created",
        "label": "Feedback Created",
        "variables": [
            "feedback.id",
            "feedback.subject",
            "feedback.message",
            "feedback.feedback_type",
            "feedback.status",
            "user.id",
            "user.email",
            "user.name",
            "timestamp",
        ],
    },
]


class WebhookConfigCreate(BaseModel):
    """Schema for creating webhook config."""

    event_type: str = Field(..., max_length=100)
    url: SafeWebhookUrl  # Validates for SSRF
    http_method: str = Field("POST", pattern="^(POST|PUT|PATCH)$")
    headers: SafeHeaders = Field(default_factory=dict)  # Validates for CRLF injection
    body_template: str | None = None
    is_active: bool = True
    retry_count: int = Field(3, ge=0, le=10)
    timeout_seconds: int = Field(30, ge=5, le=120)


class WebhookConfigUpdate(BaseModel):
    """Schema for updating webhook config."""

    url: SafeWebhookUrl | None = None  # Validates for SSRF
    http_method: str | None = Field(None, pattern="^(POST|PUT|PATCH)$")
    headers: SafeHeaders | None = None  # Validates for CRLF injection
    body_template: str | None = None
    is_active: bool | None = None
    retry_count: int | None = Field(None, ge=0, le=10)
    timeout_seconds: int | None = Field(None, ge=5, le=120)


class WebhookConfigResponse(BaseModel):
    """Schema for webhook config response."""

    id: UUID
    event_type: str
    url: str
    http_method: str
    headers: dict[str, str]
    body_template: str | None
    is_active: bool
    retry_count: int
    timeout_seconds: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WebhookExecutionResponse(BaseModel):
    """Schema for webhook execution log."""

    id: UUID
    webhook_config_id: UUID
    event_type: str
    event_payload: dict
    request_url: str
    request_headers: dict
    request_body: str
    response_status: int | None
    response_body: str | None
    status: str
    attempt_number: int
    error_message: str | None
    executed_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class PaginatedExecutionsResponse(BaseModel):
    """Paginated webhook executions."""

    items: list[WebhookExecutionResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[WebhookExecutionResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedExecutionsResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


class WebhookTestRequest(BaseModel):
    """Request to test a webhook."""

    test_payload: dict = Field(default_factory=dict)


class WebhookTestResponse(BaseModel):
    """Response from webhook test."""

    success: bool
    status_code: int | None
    response_body: str | None
    error: str | None


class EventTypeInfo(BaseModel):
    """Information about an event type."""

    value: str
    label: str
    variables: list[str]
