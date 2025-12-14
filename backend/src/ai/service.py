import base64
import json
import re
from typing import Any

from openai import AsyncOpenAI

from src.ai.prompt_templates import PromptTemplateManager, get_prompt_template_manager
from src.config import Settings, get_settings
from src.images.schemas import ClassificationResult
from src.locations.schemas import (
    ItemLocationSuggestionResult,
    LocationAnalysisResult,
    LocationSuggestion,
    LocationSuggestionItem,
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


class AIClassificationService:
    """Service for AI-powered image classification using OpenAI."""

    def __init__(
        self,
        settings: Settings | None = None,
        template_manager: PromptTemplateManager | None = None,
    ):
        self.settings = settings or get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self._template_manager = template_manager or get_prompt_template_manager(
            self.settings.ai_templates_dir
        )

    @property
    def template_manager(self) -> PromptTemplateManager:
        """Get the prompt template manager."""
        return self._template_manager

    async def classify_image(
        self,
        image_data: bytes,
        mime_type: str = "image/jpeg",
        custom_prompt: str | None = None,
    ) -> ClassificationResult:
        """
        Classify an image using GPT-4 Vision.

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image
            custom_prompt: Optional user-supplied prompt to augment the AI request

        Returns:
            ClassificationResult with identified item details
        """
        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(
            TEMPLATE_ITEM_CLASSIFICATION
        )
        user_prompt = self._template_manager.get_user_prompt(
            TEMPLATE_ITEM_CLASSIFICATION
        )

        # Append custom prompt if provided
        if custom_prompt:
            user_prompt = (
                f"{user_prompt}\n\nAdditional context from the user:\n{custom_prompt}"
            )

        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode("utf-8")

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
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
            max_tokens=1000,
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
        except json.JSONDecodeError:
            # Fallback if parsing fails
            data = {
                "identified_name": "Unknown Item",
                "confidence": 0.0,
                "category_path": "Uncategorized",
                "description": content,
                "specifications": {},
            }

        return ClassificationResult(
            identified_name=data.get("identified_name", "Unknown Item"),
            confidence=float(data.get("confidence", 0.0)),
            category_path=data.get("category_path", "Uncategorized"),
            description=data.get("description", ""),
            specifications=data.get("specifications", {}),
            alternative_suggestions=data.get("alternative_suggestions"),
            quantity_estimate=data.get("quantity_estimate"),
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

        return {
            "name": classification.identified_name,
            "description": classification.description,
            "attributes": {
                "specifications": classification.specifications,
            },
            "suggested_category_path": classification.category_path,
            "quantity": quantity_data["quantity"],
            "quantity_unit": quantity_data["quantity_unit"],
            "quantity_estimate_raw": classification.quantity_estimate,
        }

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
        # Get prompts from templates
        system_prompt = self._template_manager.get_system_prompt(
            TEMPLATE_LOCATION_ANALYSIS
        )
        user_prompt = self._template_manager.get_user_prompt(TEMPLATE_LOCATION_ANALYSIS)

        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode("utf-8")

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
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
            max_tokens=2000,  # Higher limit for potentially many children
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
        except json.JSONDecodeError:
            # Fallback if parsing fails
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

        return LocationAnalysisResult(
            parent=parent,
            children=children,
            confidence=float(data.get("confidence", 0.0)),
            reasoning=data.get("reasoning", ""),
        )

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
            TEMPLATE_LOCATION_SUGGESTION, context
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1000,
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
        except json.JSONDecodeError:
            # Fallback if parsing fails
            return ItemLocationSuggestionResult(suggestions=[])

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

        return ItemLocationSuggestionResult(suggestions=suggestions)


def get_ai_service() -> AIClassificationService:
    """Get AI classification service instance."""
    return AIClassificationService()
