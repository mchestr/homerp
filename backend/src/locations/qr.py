"""QR code generation service for locations."""

import io
from uuid import UUID

import segno

from src.config import Settings, get_settings


class QRCodeService:
    """Service for generating QR codes for locations."""

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

        qr = segno.make(url, error="M")  # Medium error correction

        buffer = io.BytesIO()
        qr.save(buffer, kind="png", scale=size, border=border)
        buffer.seek(0)

        return buffer.getvalue()


def get_qr_service(settings: Settings | None = None) -> QRCodeService:
    """Get QR code service instance."""
    return QRCodeService(settings or get_settings())
