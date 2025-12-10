import os
import uuid
from pathlib import Path

import aiofiles

from src.config import Settings, get_settings


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


def get_storage() -> LocalStorage:
    """Get storage instance."""
    return LocalStorage()
