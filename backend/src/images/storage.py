import io
import os
import uuid
from pathlib import Path

import aiofiles
from PIL import Image

from src.config import Settings, get_settings

# Default thumbnail size (width x height)
THUMBNAIL_SIZE = (300, 300)


class LocalStorage:
    """Local file storage for images."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.upload_dir = Path(self.settings.upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, filename: str) -> Path:
        """Get full path for a file."""
        return self.upload_dir / filename

    def _generate_filename(self, original_filename: str | None) -> str:
        """Generate a unique filename."""
        ext = ""
        if original_filename:
            ext = Path(original_filename).suffix
        return f"{uuid.uuid4()}{ext}"

    async def save(self, content: bytes, original_filename: str | None = None) -> str:
        """
        Save file content and return the storage path.

        Returns:
            The relative storage path (filename only for local storage).
        """
        filename = self._generate_filename(original_filename)
        file_path = self._get_file_path(filename)

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        return filename

    async def read(self, storage_path: str) -> bytes:
        """Read file content from storage."""
        file_path = self._get_file_path(storage_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {storage_path}")

        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()

    async def delete(self, storage_path: str) -> None:
        """Delete a file from storage."""
        file_path = self._get_file_path(storage_path)
        if file_path.exists():
            os.remove(file_path)

    def get_full_path(self, storage_path: str) -> Path:
        """Get the full filesystem path for a stored file."""
        return self._get_file_path(storage_path)

    async def generate_thumbnail(
        self, content: bytes, original_filename: str | None = None
    ) -> str | None:
        """
        Generate a thumbnail from image content.

        Returns:
            The storage path for the thumbnail, or None if generation fails.
        """
        try:
            # Open image from bytes
            img = Image.open(io.BytesIO(content))

            # Convert to RGB if necessary (for PNG with transparency, etc.)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Create thumbnail (maintains aspect ratio)
            img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Save to bytes
            thumb_buffer = io.BytesIO()
            img.save(thumb_buffer, format="JPEG", quality=85, optimize=True)
            thumb_content = thumb_buffer.getvalue()

            # Generate thumbnail filename
            thumb_filename = self._generate_filename(original_filename)
            # Add _thumb suffix before extension
            stem = Path(thumb_filename).stem
            thumb_filename = f"{stem}_thumb.jpg"

            # Save thumbnail
            thumb_path = self._get_file_path(thumb_filename)
            async with aiofiles.open(thumb_path, "wb") as f:
                await f.write(thumb_content)

            return thumb_filename

        except Exception:
            # If thumbnail generation fails, return None
            # The original image can still be used
            return None


def get_storage() -> LocalStorage:
    """Get storage instance."""
    return LocalStorage()
