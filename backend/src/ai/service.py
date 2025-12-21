import base64
import json
import logging
import re
from decimal import Decimal
from typing import Annotated, Any

from fastapi import Depends
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion

from src.ai.prompt_templates import PromptTemplateManager, get_prompt_template_manager
from src.ai.schemas import TokenUsage
from src.ai.settings_service import (
    AIModelSettingsService,
    get_ai_model_settings_service,
)
from src.config import Settings, get_settings
from src.images.schemas import ClassificationResult, Specification
from src.locations.schemas import (
    ItemLocationSuggestionResult,
    LocationAnalysisResult,
    LocationSuggestion,
    LocationSuggestionItem,
)

logger = logging.getLogger(__name__)

# OpenAI pricing per 1M tokens
# Last updated: December 15, 2024
# Source: https://openai.com/pricing
MODEL_PRICING: dict[str, dict[str, Decimal]] = {
    # GPT-4o models
    "gpt-4o": {"input": Decimal("2.50"), "output": Decimal("10.00")},
    "gpt-4o-2024-11-20": {"input": Decimal("2.50"), "output": Decimal("10.00")},
    "gpt-4o-2024-08-06": {"input": Decimal("2.50"), "output": Decimal("10.00")},
    "gpt-4o-2024-05-13": {"input": Decimal("5.00"), "output": Decimal("15.00")},
    # GPT-4o-mini
    "gpt-4o-mini": {"input": Decimal("0.15"), "output": Decimal("0.60")},
    "gpt-4o-mini-2024-07-18": {"input": Decimal("0.15"), "output": Decimal("0.60")},
    # GPT-4 Turbo
    "gpt-4-turbo": {"input": Decimal("10.00"), "output": Decimal("30.00")},
    "gpt-4-turbo-2024-04-09": {"input": Decimal("10.00"), "output": Decimal("30.00")},
    # GPT-4 Vision (legacy)
    "gpt-4-vision-preview": {"input": Decimal("10.00"), "output": Decimal("30.00")},
    # GPT-4
    "gpt-4": {"input": Decimal("30.00"), "output": Decimal("60.00")},
    # Default fallback (use gpt-4o pricing)
    "default": {"input": Decimal("2.50"), "output": Decimal("10.00")},
}


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
    """Calculate estimated cost in USD based on token usage and model pricing."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["default"])
    # Price is per 1M tokens, so divide by 1,000,000
    input_cost = (Decimal(prompt_tokens) / Decimal("1000000")) * pricing["input"]
    output_cost = (Decimal(completion_tokens) / Decimal("1000000")) * pricing["output"]
    return (input_cost + output_cost).quantize(Decimal("0.000001"))


def extract_token_usage(response: ChatCompletion) -> TokenUsage:
    """Extract token usage information from OpenAI API response."""
    usage = response.usage
    if usage is None:
        # Fallback if usage is not available (shouldn't happen normally)
        return TokenUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            model=response.model,
            estimated_cost_usd=Decimal("0"),
        )

    prompt_tokens = usage.prompt_tokens
    completion_tokens = usage.completion_tokens
    total_tokens = usage.total_tokens
    model = response.model

    estimated_cost = calculate_cost(model, prompt_tokens, completion_tokens)

    return TokenUsage(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        model=model,
        estimated_cost_usd=estimated_cost,
    )


# Unit aliases for normalization
UNIT_ALIASES: dict[str, str] = {
    "pieces": "pcs",
    "piece": "pcs",
    "pcs": "pcs",
    "pc": "pcs",
    "units": "pcs",
    "unit": "pcs",
    "items": "pcs",
    "item": "pcs",
    "meters": "m",
    "meter": "m",
    "m": "m",
    "centimeters": "cm",
    "centimeter": "cm",
    "cm": "cm",
    "millimeters": "mm",
    "millimeter": "mm",
    "mm": "mm",
    "feet": "ft",
    "foot": "ft",
    "ft": "ft",
    "inches": "in",
    "inch": "in",
    "in": "in",
    "kilograms": "kg",
    "kilogram": "kg",
    "kg": "kg",
    "grams": "g",
    "gram": "g",
    "g": "g",
    "pounds": "lb",
    "pound": "lb",
    "lbs": "lb",
    "lb": "lb",
    "ounces": "oz",
    "ounce": "oz",
    "oz": "oz",
    "liters": "L",
    "liter": "L",
    "l": "L",
    "milliliters": "mL",
    "milliliter": "mL",
    "ml": "mL",
    "rolls": "rolls",
    "roll": "rolls",
    "packs": "packs",
    "pack": "packs",
    "boxes": "boxes",
    "box": "boxes",
    "bags": "bags",
    "bag": "bags",
    "sets": "sets",
    "set": "sets",
    "pairs": "pairs",
    "pair": "pairs",
}


def parse_quantity_estimate(estimate: str | None) -> dict[str, Any]:
    """
    Parse a quantity estimate string into numeric quantity and unit.

    Examples:
        "5 pieces" -> {"quantity": 5, "quantity_unit": "pcs"}
        "approximately 10" -> {"quantity": 10, "quantity_unit": "pcs"}
        "10m of cable" -> {"quantity": 10, "quantity_unit": "m"}
        "about 25 meters" -> {"quantity": 25, "quantity_unit": "m"}
        "1 kg" -> {"quantity": 1, "quantity_unit": "kg"}
        None or unparseable -> {"quantity": 1, "quantity_unit": "pcs"}

    Args:
        estimate: The quantity estimate string from AI

    Returns:
        Dictionary with quantity (int) and quantity_unit (str)
    """
    if not estimate:
        return {"quantity": 1, "quantity_unit": "pcs"}

    estimate = estimate.strip().lower()

    # Pattern 1: "10m", "5kg", "25cm" (number directly followed by unit abbreviation)
    match = re.match(r"(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)", estimate)
    if match:
        num_str, unit_str = match.groups()
        try:
            quantity = int(float(num_str))
            quantity = max(1, quantity)  # Ensure at least 1
            unit = UNIT_ALIASES.get(unit_str.lower(), "pcs")
            return {"quantity": quantity, "quantity_unit": unit}
        except ValueError:
            pass

    # Pattern 2: Extract first number and look for unit words
    # Matches patterns like "approximately 10 pieces", "about 5", "around 25 meters"
    num_match = re.search(r"(-?\d+(?:\.\d+)?)", estimate)
    if num_match:
        try:
            quantity = int(float(num_match.group(1)))
            quantity = max(1, quantity)  # Ensure at least 1

            # Look for unit words in the rest of the string
            unit = "pcs"  # Default
            for alias, normalized_unit in UNIT_ALIASES.items():
                if re.search(rf"\b{re.escape(alias)}\b", estimate):
                    unit = normalized_unit
                    break

            return {"quantity": quantity, "quantity_unit": unit}
        except ValueError:
            pass

    # Fallback: couldn't parse, return defaults
    return {"quantity": 1, "quantity_unit": "pcs"}


# Template category names
TEMPLATE_ITEM_CLASSIFICATION = "item_classification"
TEMPLATE_LOCATION_ANALYSIS = "location_analysis"
TEMPLATE_LOCATION_SUGGESTION = "location_suggestion"
TEMPLATE_ASSISTANT = "assistant"


class AIClassificationService:
    """Service for AI-powered image classification using OpenAI."""

    def __init__(
        self,
        settings: Settings | None = None,
        template_manager: PromptTemplateManager | None = None,
        model_settings_service: AIModelSettingsService | None = None,
    ):
        self.settings = settings or get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self._template_manager = template_manager or get_prompt_template_manager(
            self.settings.ai_templates_dir
        )
        self.model_settings_service = model_settings_service

    @property
    def template_manager(self) -> PromptTemplateManager:
        """Get the prompt template manager."""
        return self._template_manager

    async def classify_images_with_usage(
        self,
        images: list[tuple[bytes, str]],
        custom_prompt: str | None = None,
        spec_hints: list[str] | None = None,
    ) -> tuple[ClassificationResult, TokenUsage]:
        """
        Classify one or more images using GPT-4 Vision and return token usage.

        Multiple images are sent together in a single request, allowing the AI
        to see different angles/views of the same item for better identification.

        Args:
            images: List of tuples containing (image_data, mime_type)
            custom_prompt: Optional user-supplied prompt to augment the AI request
            spec_hints: Optional list of common specification keys from user's inventory
                       to help the AI identify relevant specifications

        Returns:
            Tuple of (ClassificationResult, TokenUsage)
        """
        if not images:
            raise ValueError("At least one image is required")

        logger.info(
            f"Starting image classification: image_count={len(images)}, "
            f"has_custom_prompt={custom_prompt is not None}, "
            f"has_spec_hints={spec_hints is not None}, "
            f"spec_hints_count={len(spec_hints) if spec_hints else 0}, "
            f"model={self.settings.openai_model}"
        )

        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(
            TEMPLATE_ITEM_CLASSIFICATION
        )
        user_prompt = self._template_manager.get_user_prompt(
            TEMPLATE_ITEM_CLASSIFICATION
        )

        # Add multi-image context if multiple images provided
        if len(images) > 1:
            user_prompt = (
                f"{user_prompt}\n\nNote: You are being shown {len(images)} images "
                "of the same item from different angles. Use all images together "
                "to make the most accurate identification."
            )

        # Add specification hints from existing inventory
        if spec_hints and len(spec_hints) > 0:
            # Sanitize hints to prevent prompt injection
            sanitized_hints = [
                hint.replace("\n", " ").replace("\r", "").strip()
                for hint in spec_hints[:15]
            ]
            hints_text = ", ".join(sanitized_hints)
            user_prompt = (
                f"{user_prompt}\n\n"
                f"Note: Similar items in this inventory commonly have these specifications: "
                f"{hints_text}. "
                f"Please try to identify these specifications if they are visible or determinable from the image."
            )

        # Append custom prompt if provided
        if custom_prompt:
            user_prompt = (
                f"{user_prompt}\n\nAdditional context from the user:\n{custom_prompt}"
            )

        # Build content array with text prompt and all images
        content: list[dict[str, Any]] = [{"type": "text", "text": user_prompt}]

        for image_data, mime_type in images:
            base64_image = base64.b64encode(image_data).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_image}",
                        "detail": "high",
                    },
                }
            )

        # Get dynamic model settings
        operation_settings = await self.model_settings_service.get_operation_settings(
            "image_classification"
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=operation_settings["model_name"],
            temperature=operation_settings["temperature"],
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": content,
                },
            ],
            max_tokens=operation_settings["max_tokens"],
        )

        # Extract token usage
        token_usage = extract_token_usage(response)

        logger.info(
            f"OpenAI API response: model={token_usage.model}, "
            f"prompt_tokens={token_usage.prompt_tokens}, "
            f"completion_tokens={token_usage.completion_tokens}, "
            f"total_tokens={token_usage.total_tokens}, "
            f"estimated_cost_usd={token_usage.estimated_cost_usd}"
        )

        # Parse response
        response_content = response.choices[0].message.content or "{}"

        # Try to extract JSON from the response
        try:
            # Handle case where response might have markdown code blocks
            if "```json" in response_content:
                response_content = (
                    response_content.split("```json")[1].split("```")[0].strip()
                )
            elif "```" in response_content:
                response_content = (
                    response_content.split("```")[1].split("```")[0].strip()
                )

            data = json.loads(response_content)
        except json.JSONDecodeError as e:
            # Fallback if parsing fails
            snippet = (
                response_content[:200] + "..."
                if len(response_content) > 200
                else response_content
            )
            logger.warning(
                f"Failed to parse AI classification response as JSON: error={e}, "
                f"response_length={len(response_content)}, snippet={snippet!r}"
            )
            data = {
                "identified_name": "Unknown Item",
                "confidence": 0.0,
                "category_path": "Uncategorized",
                "description": response_content,
                "specifications": {},
            }

        # Convert specifications dict from AI to array format
        raw_specs = data.get("specifications", {})
        specifications: list[Specification] = []
        if isinstance(raw_specs, dict):
            for key, value in raw_specs.items():
                # Ensure value is a valid type
                if isinstance(value, (str, int, float, bool)):
                    specifications.append(Specification(key=str(key), value=value))
                else:
                    # Convert to string for complex types
                    specifications.append(Specification(key=str(key), value=str(value)))

        result = ClassificationResult(
            identified_name=data.get("identified_name", "Unknown Item"),
            confidence=float(data.get("confidence", 0.0)),
            category_path=data.get("category_path", "Uncategorized"),
            description=data.get("description", ""),
            specifications=specifications,
            alternative_suggestions=data.get("alternative_suggestions"),
            quantity_estimate=data.get("quantity_estimate"),
        )

        logger.info(
            f"Classification complete: identified_name={result.identified_name}, "
            f"confidence={result.confidence}, category={result.category_path}"
        )

        return result, token_usage

    async def classify_images(
        self,
        images: list[tuple[bytes, str]],
        custom_prompt: str | None = None,
        spec_hints: list[str] | None = None,
    ) -> ClassificationResult:
        """
        Classify one or more images using GPT-4 Vision.

        Multiple images are sent together in a single request, allowing the AI
        to see different angles/views of the same item for better identification.

        Args:
            images: List of tuples containing (image_data, mime_type)
            custom_prompt: Optional user-supplied prompt to augment the AI request
            spec_hints: Optional list of common specification keys from user's inventory

        Returns:
            ClassificationResult with identified item details
        """
        result, _ = await self.classify_images_with_usage(
            images, custom_prompt, spec_hints
        )
        return result

    async def classify_image(
        self,
        image_data: bytes,
        mime_type: str = "image/jpeg",
        custom_prompt: str | None = None,
        spec_hints: list[str] | None = None,
    ) -> ClassificationResult:
        """
        Classify a single image using GPT-4 Vision.

        This is a convenience wrapper around classify_images for single-image use.

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image
            custom_prompt: Optional user-supplied prompt to augment the AI request
            spec_hints: Optional list of common specification keys from user's inventory

        Returns:
            ClassificationResult with identified item details
        """
        return await self.classify_images(
            images=[(image_data, mime_type)],
            custom_prompt=custom_prompt,
            spec_hints=spec_hints,
        )

    def create_item_prefill(
        self, classification: ClassificationResult
    ) -> dict[str, Any]:
        """
        Create prefill data for item creation form.

        Args:
            classification: The classification result

        Returns:
            Dictionary with prefill data for item creation
        """
        # Parse quantity estimate into numeric values
        quantity_data = parse_quantity_estimate(classification.quantity_estimate)

        # Convert Specification objects to dicts for JSON serialization
        specifications = [
            {"key": spec.key, "value": spec.value}
            for spec in classification.specifications
        ]

        return {
            "name": classification.identified_name,
            "description": classification.description,
            "attributes": {
                "specifications": specifications,
            },
            "suggested_category_path": classification.category_path,
            "quantity": quantity_data["quantity"],
            "quantity_unit": quantity_data["quantity_unit"],
            "quantity_estimate_raw": classification.quantity_estimate,
        }

    async def analyze_location_image_with_usage(
        self, image_data: bytes, mime_type: str = "image/jpeg"
    ) -> tuple[LocationAnalysisResult, TokenUsage]:
        """
        Analyze an image to suggest location structure and return token usage.

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image

        Returns:
            Tuple of (LocationAnalysisResult, TokenUsage)
        """
        logger.info(
            f"Starting location image analysis: model={self.settings.openai_model}"
        )

        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(
            TEMPLATE_LOCATION_ANALYSIS
        )
        user_prompt = self._template_manager.get_user_prompt(TEMPLATE_LOCATION_ANALYSIS)

        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode("utf-8")

        # Get dynamic model settings
        operation_settings = await self.model_settings_service.get_operation_settings(
            "location_analysis"
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=operation_settings["model_name"],
            temperature=operation_settings["temperature"],
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            max_tokens=operation_settings["max_tokens"],
        )

        # Extract token usage
        token_usage = extract_token_usage(response)

        logger.info(
            f"Location analysis API response: model={token_usage.model}, "
            f"total_tokens={token_usage.total_tokens}, "
            f"estimated_cost_usd={token_usage.estimated_cost_usd}"
        )

        # Parse response
        content = response.choices[0].message.content or "{}"

        # Try to extract JSON from the response
        try:
            # Handle case where response might have markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)
        except json.JSONDecodeError as e:
            # Fallback if parsing fails
            snippet = content[:200] + "..." if len(content) > 200 else content
            logger.warning(
                f"Failed to parse location analysis response as JSON: error={e}, "
                f"response_length={len(content)}, snippet={snippet!r}"
            )
            data = {
                "parent": {
                    "name": "Unknown Storage",
                    "location_type": "shelf",
                    "description": "Could not analyze the image",
                },
                "children": [],
                "confidence": 0.0,
                "reasoning": content,
            }

        # Parse parent
        parent_data = data.get("parent", {})
        parent = LocationSuggestion(
            name=parent_data.get("name", "Unknown Storage"),
            location_type=parent_data.get("location_type", "shelf"),
            description=parent_data.get("description"),
        )

        # Parse children
        children = []
        for child_data in data.get("children", []):
            children.append(
                LocationSuggestion(
                    name=child_data.get("name", "Compartment"),
                    location_type=child_data.get("location_type", "bin"),
                    description=child_data.get("description"),
                )
            )

        result = LocationAnalysisResult(
            parent=parent,
            children=children,
            confidence=float(data.get("confidence", 0.0)),
            reasoning=data.get("reasoning", ""),
        )

        logger.info(
            f"Location analysis complete: parent_name={result.parent.name}, "
            f"children_count={len(result.children)}, confidence={result.confidence}"
        )

        return result, token_usage

    async def analyze_location_image(
        self, image_data: bytes, mime_type: str = "image/jpeg"
    ) -> LocationAnalysisResult:
        """
        Analyze an image to suggest location structure using GPT-4 Vision.

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image

        Returns:
            LocationAnalysisResult with suggested parent and children locations
        """
        result, _ = await self.analyze_location_image_with_usage(image_data, mime_type)
        return result

    async def suggest_item_location_with_usage(
        self,
        item_name: str,
        item_category: str | None,
        item_description: str | None,
        item_specifications: dict[str, Any] | None,
        locations: list[dict[str, Any]],
        similar_items: list[dict[str, Any]] | None = None,
    ) -> tuple[ItemLocationSuggestionResult, TokenUsage]:
        """
        Suggest optimal storage locations and return token usage.

        Args:
            item_name: Name of the item to store
            item_category: Category path of the item (e.g., "Hardware > Fasteners")
            item_description: Description of the item
            item_specifications: Technical specifications of the item
            locations: List of available locations with structure:
                [{"id": uuid, "name": str, "type": str, "item_count": int,
                  "sample_items": list[str]}]
            similar_items: Optional list of similar items with their locations:
                [{"name": str, "location": str}]

        Returns:
            Tuple of (ItemLocationSuggestionResult, TokenUsage)
        """
        logger.info(
            f"Starting location suggestion: item_name={item_name}, "
            f"locations_count={len(locations)}, "
            f"similar_items_count={len(similar_items) if similar_items else 0}"
        )

        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(
            TEMPLATE_LOCATION_SUGGESTION
        )

        # Prepare template context for user prompt
        context = {
            "item_name": item_name,
            "item_category": item_category,
            "item_description": item_description,
            "item_specifications": item_specifications,
            "locations": locations,
            "similar_items": similar_items,
        }

        user_prompt = self._template_manager.get_user_prompt(
            TEMPLATE_LOCATION_SUGGESTION, **context
        )

        # Get dynamic model settings
        operation_settings = await self.model_settings_service.get_operation_settings(
            "location_suggestion"
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=operation_settings["model_name"],
            temperature=operation_settings["temperature"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=operation_settings["max_tokens"],
        )

        # Extract token usage
        token_usage = extract_token_usage(response)

        logger.info(
            f"Location suggestion API response: model={token_usage.model}, "
            f"total_tokens={token_usage.total_tokens}, "
            f"estimated_cost_usd={token_usage.estimated_cost_usd}"
        )

        # Parse response
        content = response.choices[0].message.content or "{}"

        # Try to extract JSON from the response
        try:
            # Handle case where response might have markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)
        except json.JSONDecodeError as e:
            # Fallback if parsing fails
            snippet = content[:200] + "..." if len(content) > 200 else content
            logger.warning(
                f"Failed to parse location suggestion response as JSON: error={e}, "
                f"response_length={len(content)}, snippet={snippet!r}"
            )
            return ItemLocationSuggestionResult(suggestions=[]), token_usage

        # Parse suggestions
        suggestions = []
        for suggestion_data in data.get("suggestions", []):
            try:
                location_id = suggestion_data.get("location_id")
                if location_id:
                    from uuid import UUID

                    suggestions.append(
                        LocationSuggestionItem(
                            location_id=UUID(location_id),
                            location_name=suggestion_data.get(
                                "location_name", "Unknown"
                            ),
                            confidence=float(suggestion_data.get("confidence", 0.0)),
                            reasoning=suggestion_data.get(
                                "reasoning", "No reasoning provided"
                            ),
                        )
                    )
            except (ValueError, TypeError):
                # Skip invalid suggestion entries
                continue

        logger.info(
            f"Location suggestion complete: item_name={item_name}, "
            f"suggestions_count={len(suggestions)}"
        )

        return ItemLocationSuggestionResult(suggestions=suggestions), token_usage

    async def suggest_item_location(
        self,
        item_name: str,
        item_category: str | None,
        item_description: str | None,
        item_specifications: dict[str, Any] | None,
        locations: list[dict[str, Any]],
        similar_items: list[dict[str, Any]] | None = None,
    ) -> ItemLocationSuggestionResult:
        """
        Suggest optimal storage locations for an item based on its characteristics
        and the user's existing location structure.

        Args:
            item_name: Name of the item to store
            item_category: Category path of the item (e.g., "Hardware > Fasteners")
            item_description: Description of the item
            item_specifications: Technical specifications of the item
            locations: List of available locations with structure:
                [{"id": uuid, "name": str, "type": str, "item_count": int,
                  "sample_items": list[str]}]
            similar_items: Optional list of similar items with their locations:
                [{"name": str, "location": str}]

        Returns:
            ItemLocationSuggestionResult with ranked location suggestions
        """
        result, _ = await self.suggest_item_location_with_usage(
            item_name,
            item_category,
            item_description,
            item_specifications,
            locations,
            similar_items,
        )
        return result

    async def query_assistant_with_usage(
        self,
        user_prompt: str,
        inventory_context: dict[str, Any] | None = None,
    ) -> tuple[str, TokenUsage]:
        """
        Query the AI assistant and return token usage.

        Args:
            user_prompt: The user's question or request
            inventory_context: Optional dictionary with inventory data for context

        Returns:
            Tuple of (response_text, TokenUsage)
        """
        logger.info(
            f"Starting assistant query: prompt_length={len(user_prompt)}, "
            f"has_inventory_context={inventory_context is not None}"
        )

        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(TEMPLATE_ASSISTANT)

        # Get user message from template with variables
        user_message = self._template_manager.get_user_prompt(
            TEMPLATE_ASSISTANT,
            user_prompt=user_prompt,
            inventory_context=inventory_context,
        )

        # Get dynamic model settings
        operation_settings = await self.model_settings_service.get_operation_settings(
            "assistant_query"
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=operation_settings["model_name"],
            temperature=operation_settings["temperature"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=operation_settings["max_tokens"],
        )

        # Extract token usage
        token_usage = extract_token_usage(response)

        logger.info(
            f"Assistant query API response: model={token_usage.model}, "
            f"total_tokens={token_usage.total_tokens}, "
            f"estimated_cost_usd={token_usage.estimated_cost_usd}"
        )

        return response.choices[0].message.content or "", token_usage

    async def query_assistant(
        self,
        user_prompt: str,
        inventory_context: dict[str, Any] | None = None,
    ) -> str:
        """
        Query the AI assistant with a user prompt and optional inventory context.

        Args:
            user_prompt: The user's question or request
            inventory_context: Optional dictionary with inventory data for context

        Returns:
            The AI assistant's response text
        """
        result, _ = await self.query_assistant_with_usage(
            user_prompt, inventory_context
        )
        return result

    async def query_assistant_with_tools(
        self,
        user_prompt: str,
        conversation_history: list[dict[str, Any]],
        tool_executor: Any,  # Type hint avoids circular import
        max_tool_calls: int = 5,
    ) -> tuple[str, list[dict[str, Any]], TokenUsage]:
        """
        Query the AI assistant with tool-calling capability.

        Implements a loop that handles tool calls until the model produces
        a final text response or max iterations is reached.

        Args:
            user_prompt: The user's current message
            conversation_history: Previous messages in OpenAI format
            tool_executor: ToolExecutor instance for running tools
            max_tool_calls: Maximum tool call iterations to prevent infinite loops

        Returns:
            Tuple of (final_response_text, all_new_messages, total_token_usage)
        """
        from src.ai.tools import INVENTORY_TOOLS

        logger.info(
            f"Starting assistant query with tools: prompt_length={len(user_prompt)}, "
            f"history_length={len(conversation_history)}"
        )

        # Get system prompt and enhance with tool usage instructions
        system_prompt = self._template_manager.get_system_prompt(TEMPLATE_ASSISTANT)
        system_prompt += """

## Tool Usage
You have access to tools to query the user's inventory. Use them when you need specific information about items, categories, locations, or stock levels.

**CRITICAL: When referencing items, use the markdown_link field from tool results EXACTLY as provided.** Each item includes a ready-to-use markdown_link like `[Item Name](/items/ITEM_ID)` - copy this verbatim into your response to create clickable links.

If a tool returns no results, tell the user and suggest alternatives.
"""

        # Build messages array
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            *conversation_history,
            {"role": "user", "content": user_prompt},
        ]

        all_new_messages: list[dict[str, Any]] = []
        total_usage = TokenUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            model="",
            estimated_cost_usd=Decimal("0"),
        )

        # Get dynamic model settings
        operation_settings = await self.model_settings_service.get_operation_settings(
            "assistant_query"
        )

        for iteration in range(max_tool_calls):
            logger.debug(f"Tool call iteration {iteration + 1}/{max_tool_calls}")

            response = await self.client.chat.completions.create(
                model=operation_settings["model_name"],
                temperature=operation_settings["temperature"],
                messages=messages,
                tools=INVENTORY_TOOLS,
                tool_choice="auto",
                max_tokens=operation_settings["max_tokens"],
            )

            # Accumulate token usage
            usage = extract_token_usage(response)
            total_usage.prompt_tokens += usage.prompt_tokens
            total_usage.completion_tokens += usage.completion_tokens
            total_usage.total_tokens += usage.total_tokens
            total_usage.model = usage.model
            total_usage.estimated_cost_usd += usage.estimated_cost_usd

            assistant_message = response.choices[0].message

            # Build message dict for history
            msg_dict: dict[str, Any] = {"role": "assistant"}
            if assistant_message.content:
                msg_dict["content"] = assistant_message.content
            if assistant_message.tool_calls:
                msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in assistant_message.tool_calls
                ]

            messages.append(msg_dict)
            all_new_messages.append(msg_dict)

            # If no tool calls, we have the final response
            if not assistant_message.tool_calls:
                logger.info(
                    f"Assistant query with tools complete: iterations={iteration + 1}, "
                    f"total_tokens={total_usage.total_tokens}"
                )
                return assistant_message.content or "", all_new_messages, total_usage

            # Execute each tool call
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    arguments = {}

                logger.info(f"Executing tool: {function_name}")
                result = await tool_executor.execute(function_name, arguments)

                tool_message = {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": result,
                }
                messages.append(tool_message)
                all_new_messages.append(tool_message)

        # Max iterations reached, get final response without tools
        logger.warning(
            f"Max tool call iterations ({max_tool_calls}) reached, "
            "getting final response"
        )

        response = await self.client.chat.completions.create(
            model=operation_settings["model_name"],
            temperature=operation_settings["temperature"],
            messages=messages,
            max_tokens=operation_settings["max_tokens"],
        )

        usage = extract_token_usage(response)
        total_usage.prompt_tokens += usage.prompt_tokens
        total_usage.completion_tokens += usage.completion_tokens
        total_usage.total_tokens += usage.total_tokens
        total_usage.estimated_cost_usd += usage.estimated_cost_usd

        final_content = response.choices[0].message.content or ""
        all_new_messages.append({"role": "assistant", "content": final_content})

        logger.info(
            f"Assistant query with tools complete (max iterations): "
            f"total_tokens={total_usage.total_tokens}"
        )

        return final_content, all_new_messages, total_usage


async def get_ai_service(
    model_settings_service: Annotated[
        AIModelSettingsService, Depends(get_ai_model_settings_service)
    ],
) -> AIClassificationService:
    """Get AI classification service instance with injected dependencies."""
    return AIClassificationService(model_settings_service=model_settings_service)
