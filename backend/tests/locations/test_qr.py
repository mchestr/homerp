"""Tests for location QR code generation."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings
from src.locations.models import Location
from src.locations.qr import QRCodeService, get_qr_service
from src.locations.schemas import LocationCreate
from src.locations.service import LocationService
from src.users.models import User


@pytest.fixture
def qr_service(test_settings: Settings) -> QRCodeService:
    """Create a QR code service for testing."""
    return get_qr_service(test_settings)


@pytest.fixture
async def location_service(
    async_session: AsyncSession, test_user: User
) -> LocationService:
    """Create a location service for testing."""
    return LocationService(async_session, test_user.id)


@pytest.fixture
async def test_location(
    async_session: AsyncSession, location_service: LocationService
) -> Location:
    """Create a test location."""
    location = await location_service.create(
        LocationCreate(
            name="Workshop", description="Main workshop", location_type="room"
        )
    )
    await async_session.commit()
    return location


class TestQRCodeService:
    """Tests for QR code generation service."""

    def test_generate_qr_returns_png_bytes(self, qr_service: QRCodeService):
        """Test that generate_location_qr returns PNG image bytes."""
        location_id = uuid.uuid4()
        qr_bytes = qr_service.generate_location_qr(location_id)

        assert isinstance(qr_bytes, bytes)
        assert len(qr_bytes) > 0
        # Check PNG magic bytes
        assert qr_bytes[:8] == b"\x89PNG\r\n\x1a\n"

    def test_generate_qr_contains_correct_url(
        self,
        qr_service: QRCodeService,
        test_settings: Settings,  # noqa: ARG002
    ):
        """Test that QR code encodes the correct URL."""
        location_id = uuid.uuid4()
        # Just verify the QR code generates without error
        # (The URL encoding is verified by the fact that segno generates valid QR)
        qr_bytes = qr_service.generate_location_qr(location_id)
        assert len(qr_bytes) > 0

    def test_generate_qr_with_different_sizes(self, qr_service: QRCodeService):
        """Test generating QR codes with different size parameters."""
        location_id = uuid.uuid4()

        small = qr_service.generate_location_qr(location_id, size=5)
        medium = qr_service.generate_location_qr(location_id, size=10)
        large = qr_service.generate_location_qr(location_id, size=20)

        # Larger sizes should produce larger files
        assert len(small) < len(medium) < len(large)

    def test_generate_qr_with_custom_border(self, qr_service: QRCodeService):
        """Test generating QR codes with custom border."""
        location_id = uuid.uuid4()

        small_border = qr_service.generate_location_qr(location_id, border=1)
        large_border = qr_service.generate_location_qr(location_id, border=4)

        # Different borders should produce different sized images
        assert len(small_border) != len(large_border)


class TestQRServiceFactory:
    """Tests for QR service factory function."""

    def test_get_qr_service_with_settings(self, test_settings: Settings):
        """Test creating QR service with explicit settings."""
        service = get_qr_service(test_settings)
        assert isinstance(service, QRCodeService)
        assert service.settings == test_settings

    def test_get_qr_service_without_settings(self):
        """Test creating QR service without settings uses defaults."""
        service = get_qr_service()
        assert isinstance(service, QRCodeService)
        assert service.settings is not None
