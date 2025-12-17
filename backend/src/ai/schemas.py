from datetime import UTC, datetime
from decimal import Decimal

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
