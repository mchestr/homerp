from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from src.common.ai_input_validator import ValidatedPrompt


class TokenUsage(BaseModel):
    """Token usage information from OpenAI API response."""

    prompt_tokens: int = Field(..., description="Number of tokens in the prompt")
    completion_tokens: int = Field(
        ..., description="Number of tokens in the completion"
    )
    total_tokens: int = Field(..., description="Total tokens used")
    model: str = Field(..., description="Model used for the request")
    estimated_cost_usd: Decimal = Field(
        ..., description="Estimated cost in USD based on token pricing"
    )


class AssistantQueryRequest(BaseModel):
    """Request schema for AI assistant query."""

    prompt: ValidatedPrompt = Field(
        ...,
        description="The user's question or request for the AI assistant",
    )
    include_inventory_context: bool = Field(
        default=True,
        description="Whether to include inventory summary as context for the AI",
    )


class InventoryContextItem(BaseModel):
    """Summary of an item for AI context."""

    id: str
    name: str
    quantity: int
    quantity_unit: str
    category: str | None
    location: str | None


class InventoryContext(BaseModel):
    """Inventory context provided to the AI assistant."""

    total_items: int
    total_categories: int
    total_locations: int
    items_summary: list[InventoryContextItem]


class AssistantQueryResponse(BaseModel):
    """Response schema for AI assistant query."""

    success: bool
    response: str | None = Field(
        None, description="The AI assistant's response to the query"
    )
    error: str | None = Field(None, description="Error message if the query failed")
    context_used: bool = Field(
        default=False, description="Whether inventory context was included"
    )
    items_in_context: int = Field(
        default=0, description="Number of items included in context"
    )
    credits_used: int = Field(default=0, description="Number of credits consumed")


class ConversationMessage(BaseModel):
    """A message in the conversation history."""

    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AIModelSettingsResponse(BaseModel):
    """Response schema for AI model settings."""

    id: UUID
    operation_type: str
    model_name: str
    temperature: float
    max_tokens: int
    display_name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIModelSettingsUpdate(BaseModel):
    """Schema for updating AI model settings."""

    model_name: str | None = Field(None, min_length=1, max_length=100)
    temperature: float | None = Field(None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(None, gt=0, le=100000)
    display_name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    is_active: bool | None = None


# Session schemas


class SessionCreate(BaseModel):
    """Request to create a new conversation session."""

    title: str | None = Field(
        None, max_length=255, description="Optional title for the session"
    )


class SessionUpdate(BaseModel):
    """Request to update a session."""

    title: str = Field(..., min_length=1, max_length=255)


class SessionMessageResponse(BaseModel):
    """Response schema for a single message."""

    id: UUID
    role: str
    content: str | None
    tool_calls: list[dict] | None = None
    tool_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    """Response schema for a session."""

    id: UUID
    title: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class SessionDetailResponse(SessionResponse):
    """Session with messages."""

    messages: list[SessionMessageResponse] = []


class SessionListResponse(BaseModel):
    """Paginated list of sessions."""

    sessions: list[SessionResponse]
    total: int
    page: int
    limit: int


class SessionQueryRequest(BaseModel):
    """Request schema for querying with session context."""

    prompt: ValidatedPrompt = Field(..., description="The user's question or request")
    session_id: UUID | None = Field(
        None,
        description="Session ID to continue conversation. If None, creates new session.",
    )


class SessionQueryResponse(BaseModel):
    """Response for session-based query."""

    success: bool
    session_id: UUID
    response: str | None = None
    error: str | None = None
    tools_used: list[str] = []
    credits_used: int = 0
    new_messages: list[SessionMessageResponse] = []
