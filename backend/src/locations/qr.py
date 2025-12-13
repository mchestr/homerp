"""QR code generation service for locations and items."""

import io
from uuid import UUID

import segno

from src.config import Settings, get_settings


class QRCodeService:
    """Service for generating QR codes for locations and items."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def generate_location_qr(
        self,
        location_id: UUID,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """Generate a QR code PNG for a location URL.

        Args:
            location_id: The location UUID
            size: Scale factor for the QR code (default 10 = ~330px)
            border: Quiet zone around QR code in modules

        Returns:
            PNG image bytes
        """
        url = f"{self.settings.frontend_url}/locations/{location_id}"
        return self._generate_qr(url, size, border)

    def generate_item_qr(
        self,
        item_id: UUID,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """Generate a QR code PNG for an item URL.

        Args:
            item_id: The item UUID
            size: Scale factor for the QR code (default 10 = ~330px)
            border: Quiet zone around QR code in modules

        Returns:
            PNG image bytes
        """
        url = f"{self.settings.frontend_url}/items/{item_id}"
        return self._generate_qr(url, size, border)

    def _generate_qr(
        self,
        url: str,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """Generate a QR code PNG for a URL.

        Args:
            url: The URL to encode
            size: Scale factor for the QR code (default 10 = ~330px)
            border: Quiet zone around QR code in modules

        Returns:
            PNG image bytes
        """
        qr = segno.make(url, error="M")  # Medium error correction

        buffer = io.BytesIO()
        qr.save(buffer, kind="png", scale=size, border=border)
        buffer.seek(0)

        return buffer.getvalue()


def get_qr_service(settings: Settings | None = None) -> QRCodeService:
    """Get QR code service instance."""
    return QRCodeService(settings or get_settings())
