import base64
import json
from typing import Any

from openai import AsyncOpenAI

from src.config import Settings, get_settings
from src.images.schemas import ClassificationResult

SYSTEM_PROMPT = """You are an expert inventory classification assistant specializing in hobby, DIY, and electronics components. Your task is to analyze images and identify items with high precision.

You will extract:
1. Item name (specific and descriptive)
2. Category path (hierarchical, e.g., "Hardware > Fasteners > Screws")
3. Technical specifications (measurements, materials, ratings)
4. Common use cases

Be specific about measurements (M3 vs M4, 16mm vs 20mm) when visible.
For electronics, identify voltage/amperage ratings if visible.
For cables, identify connector types and lengths if discernible.

Always provide confidence scores for your identification.
If uncertain, provide alternative possibilities ranked by confidence."""

USER_PROMPT = """Analyze this image and identify the item(s) shown.

Provide your response as a JSON object with this exact structure:
{
  "identified_name": "specific item name",
  "confidence": 0.0 to 1.0,
  "category_path": "Top > Middle > Bottom",
  "description": "brief description of the item and its common uses",
  "specifications": {
    "key": "value"
  },
  "alternative_suggestions": [
    {"name": "alternative name", "confidence": 0.0 to 1.0}
  ],
  "quantity_estimate": "approximate count if multiple items visible"
}

Respond ONLY with the JSON object, no additional text."""


class AIClassificationService:
    """Service for AI-powered image classification using OpenAI."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def classify_image(self, image_data: bytes, mime_type: str = "image/jpeg") -> ClassificationResult:
        """
        Classify an image using GPT-4 Vision.

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image

        Returns:
            ClassificationResult with identified item details
        """
        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode("utf-8")

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": USER_PROMPT},
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

    def create_item_prefill(self, classification: ClassificationResult) -> dict[str, Any]:
        """
        Create prefill data for item creation form.

        Args:
            classification: The classification result

        Returns:
            Dictionary with prefill data for item creation
        """
        return {
            "name": classification.identified_name,
            "description": classification.description,
            "attributes": {
                "specifications": classification.specifications,
            },
            "suggested_category_path": classification.category_path,
        }


def get_ai_service() -> AIClassificationService:
    """Get AI classification service instance."""
    return AIClassificationService()
