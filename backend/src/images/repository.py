from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.images.models import Image
from src.items.models import Item
from src.locations.models import Location


class ImageRepository:
    """Repository for image database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def validate_item_ownership(self, item_id: UUID) -> None:
        """Validate that the item belongs to the current user.

        Raises ValueError if the item doesn't exist or belongs to another user.
        """
        result = await self.session.execute(
            select(Item.id).where(
                Item.id == item_id,
                Item.user_id == self.user_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"Item {item_id} not found or access denied")

    async def validate_location_ownership(self, location_id: UUID) -> None:
        """Validate that the location belongs to the current user.

        Raises ValueError if the location doesn't exist or belongs to another user.
        """
        result = await self.session.execute(
            select(Location.id).where(
                Location.id == location_id,
                Location.user_id == self.user_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"Location {location_id} not found or access denied")

    async def get_by_id(self, image_id: UUID) -> Image | None:
        """Get an image by ID."""
        result = await self.session.execute(
            select(Image).where(
                Image.id == image_id,
                Image.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_item(self, item_id: UUID) -> list[Image]:
        """Get all images for an item."""
        result = await self.session.execute(
            select(Image)
            .where(
                Image.item_id == item_id,
                Image.user_id == self.user_id,
            )
            .order_by(Image.is_primary.desc(), Image.created_at)
        )
        return list(result.scalars().all())

    async def count_by_item(self, item_id: UUID) -> int:
        """Count images for an item."""
        from sqlalchemy import func as sqla_func

        result = await self.session.execute(
            select(sqla_func.count(Image.id)).where(
                Image.item_id == item_id,
                Image.user_id == self.user_id,
            )
        )
        return result.scalar_one()

    async def get_by_location(self, location_id: UUID) -> list[Image]:
        """Get all images for a location."""
        result = await self.session.execute(
            select(Image)
            .where(
                Image.location_id == location_id,
                Image.user_id == self.user_id,
            )
            .order_by(Image.is_primary.desc(), Image.created_at)
        )
        return list(result.scalars().all())

    async def get_by_content_hash(self, content_hash: str) -> Image | None:
        """Get an image by content hash for this user."""
        result = await self.session.execute(
            select(Image).where(
                Image.content_hash == content_hash,
                Image.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_classified_images(
        self, page: int = 1, limit: int = 20, search: str | None = None
    ) -> tuple[list[Image], int]:
        """Get all classified images for the user with pagination and optional search.

        Args:
            page: Page number (1-indexed)
            limit: Number of items per page
            search: Optional search query to filter by identified_name in ai_result
        """
        from sqlalchemy import func as sqla_func

        # Build base conditions
        base_conditions = [
            Image.user_id == self.user_id,
            Image.ai_processed.is_(True),
        ]

        # Add search filter if provided
        if search:
            # Escape LIKE wildcards in the search pattern
            escaped_search = search.replace("%", r"\%").replace("_", r"\_")
            search_pattern = f"%{escaped_search.lower()}%"
            # Use COALESCE to handle null ai_result or missing identified_name
            search_condition = sqla_func.coalesce(
                sqla_func.lower(Image.ai_result["identified_name"].astext), ""
            ).like(search_pattern, escape="\\")
            base_conditions.append(search_condition)

        # Count total
        count_result = await self.session.execute(
            select(sqla_func.count(Image.id)).where(*base_conditions)
        )
        total = count_result.scalar_one()

        # Get paginated results
        offset = (page - 1) * limit
        result = await self.session.execute(
            select(Image)
            .where(*base_conditions)
            .order_by(Image.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        images = list(result.scalars().all())

        return images, total

    async def create(
        self,
        *,
        storage_path: str,
        storage_type: str = "local",
        original_filename: str | None = None,
        mime_type: str | None = None,
        size_bytes: int | None = None,
        content_hash: str | None = None,
        thumbnail_path: str | None = None,
        item_id: UUID | None = None,
    ) -> Image:
        """Create a new image record."""
        image = Image(
            user_id=self.user_id,
            item_id=item_id,
            storage_path=storage_path,
            storage_type=storage_type,
            original_filename=original_filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
            content_hash=content_hash,
            thumbnail_path=thumbnail_path,
        )
        self.session.add(image)
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def update_ai_result(self, image: Image, ai_result: dict) -> Image:
        """Update the AI classification result for an image."""
        image.ai_processed = True
        image.ai_result = ai_result
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def attach_to_item(
        self, image: Image, item_id: UUID, is_primary: bool = False
    ) -> Image:
        """Attach an image to an item."""
        image.item_id = item_id
        image.is_primary = is_primary
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def attach_to_location(
        self, image: Image, location_id: UUID, is_primary: bool = False
    ) -> Image:
        """Attach an image to a location."""
        image.location_id = location_id
        image.is_primary = is_primary
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def set_primary_for_location(self, image: Image) -> Image:
        """Set an image as the primary image for its location."""
        if image.location_id:
            # Unset other primary images for this location
            other_images = await self.get_by_location(image.location_id)
            for other in other_images:
                if other.id != image.id and other.is_primary:
                    other.is_primary = False

        image.is_primary = True
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def detach_from_location(self, image: Image) -> Image:
        """Detach an image from its location."""
        image.location_id = None
        image.is_primary = False
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def set_primary(self, image: Image) -> Image:
        """Set an image as the primary image for its item."""
        if image.item_id:
            # Unset other primary images for this item
            other_images = await self.get_by_item(image.item_id)
            for other in other_images:
                if other.id != image.id and other.is_primary:
                    other.is_primary = False

        image.is_primary = True
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def detach_from_item(self, image: Image) -> Image:
        """Detach an image from its item."""
        image.item_id = None
        image.is_primary = False
        await self.session.commit()
        await self.session.refresh(image)
        return image

    async def delete(self, image: Image) -> None:
        """Delete an image record."""
        await self.session.delete(image)
        await self.session.commit()
