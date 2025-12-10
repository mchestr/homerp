from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.images.models import Image


class ImageRepository:
    """Repository for image database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

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

    async def create(
        self,
        *,
        storage_path: str,
        storage_type: str = "local",
        original_filename: str | None = None,
        mime_type: str | None = None,
        size_bytes: int | None = None,
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

    async def delete(self, image: Image) -> None:
        """Delete an image record."""
        await self.session.delete(image)
        await self.session.commit()
