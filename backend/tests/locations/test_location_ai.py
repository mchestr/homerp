"""Tests for location AI analysis and bulk creation.

These tests ensure that the AI-powered location analysis and bulk creation
features work correctly.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.locations.schemas import (
    LocationAnalysisResult,
    LocationBulkCreate,
    LocationCreate,
    LocationSuggestion,
)
from src.locations.service import LocationService
from src.users.models import User


@pytest.fixture
async def location_service(
    async_session: AsyncSession, test_user: User
) -> LocationService:
    """Create a location service for testing."""
    return LocationService(async_session, test_user.id)


class TestBulkLocationCreation:
    """Tests for bulk location creation."""

    async def test_create_bulk_parent_only(
        self, location_service: LocationService, async_session: AsyncSession
    ):
        """Test creating a parent location with no children."""
        bulk_data = LocationBulkCreate(
            parent=LocationCreate(
                name="Toolbox",
                description="Red toolbox",
                location_type="cabinet",
            ),
            children=[],
        )

        parent, children = await location_service.create_bulk(bulk_data)
        await async_session.commit()

        assert parent.name == "Toolbox"
        assert parent.description == "Red toolbox"
        assert parent.location_type == "cabinet"
        assert str(parent.path) == "toolbox"
        assert parent.parent_id is None
        assert len(children) == 0

    async def test_create_bulk_with_children(
        self, location_service: LocationService, async_session: AsyncSession
    ):
        """Test creating a parent location with multiple children."""
        bulk_data = LocationBulkCreate(
            parent=LocationCreate(
                name="Workbench",
                description="Workshop workbench",
                location_type="shelf",
            ),
            children=[
                LocationCreate(
                    name="Drawer 1",
                    description="Top drawer",
                    location_type="drawer",
                ),
                LocationCreate(
                    name="Drawer 2",
                    description="Bottom drawer",
                    location_type="drawer",
                ),
                LocationCreate(
                    name="Drawer 3",
                    description="Middle drawer",
                    location_type="drawer",
                ),
            ],
        )

        parent, children = await location_service.create_bulk(bulk_data)
        await async_session.commit()

        assert parent.name == "Workbench"
        assert str(parent.path) == "workbench"
        assert len(children) == 3

        # Check children have correct parent_id and paths
        for child in children:
            assert child.parent_id == parent.id
            assert str(child.path).startswith("workbench.")

        # Check specific children
        drawer1 = next(c for c in children if c.name == "Drawer 1")
        assert str(drawer1.path) == "workbench.drawer_1"
        assert drawer1.description == "Top drawer"
        assert drawer1.location_type == "drawer"

    async def test_create_bulk_children_in_order(
        self, location_service: LocationService, async_session: AsyncSession
    ):
        """Test that children are created in the correct order."""
        bulk_data = LocationBulkCreate(
            parent=LocationCreate(name="Cabinet", location_type="cabinet"),
            children=[
                LocationCreate(name="Shelf A", location_type="shelf"),
                LocationCreate(name="Shelf B", location_type="shelf"),
                LocationCreate(name="Shelf C", location_type="shelf"),
            ],
        )

        parent, children = await location_service.create_bulk(bulk_data)
        await async_session.commit()

        assert len(children) == 3
        # Children should be in the order they were provided
        assert children[0].name == "Shelf A"
        assert children[1].name == "Shelf B"
        assert children[2].name == "Shelf C"

    async def test_create_bulk_with_nested_parent(
        self, location_service: LocationService, async_session: AsyncSession
    ):
        """Test creating bulk locations under an existing parent."""
        # First create an existing location
        existing = await location_service.create(
            LocationCreate(name="Garage", location_type="room")
        )
        await async_session.commit()

        # Now create bulk under the existing location
        bulk_data = LocationBulkCreate(
            parent=LocationCreate(
                name="Workbench",
                location_type="shelf",
                parent_id=existing.id,
            ),
            children=[
                LocationCreate(name="Drawer 1", location_type="drawer"),
            ],
        )

        parent, children = await location_service.create_bulk(bulk_data)
        await async_session.commit()

        assert parent.parent_id == existing.id
        assert str(parent.path) == "garage.workbench"
        assert len(children) == 1
        assert str(children[0].path) == "garage.workbench.drawer_1"


class TestLocationAnalysisSchemas:
    """Tests for location analysis schemas."""

    def test_location_suggestion_schema(self):
        """Test LocationSuggestion schema validation."""
        suggestion = LocationSuggestion(
            name="Toolbox",
            location_type="cabinet",
            description="Red metal toolbox",
        )
        assert suggestion.name == "Toolbox"
        assert suggestion.location_type == "cabinet"
        assert suggestion.description == "Red metal toolbox"

    def test_location_analysis_result_schema(self):
        """Test LocationAnalysisResult schema validation."""
        result = LocationAnalysisResult(
            parent=LocationSuggestion(
                name="Workbench",
                location_type="shelf",
                description="Workshop workbench with drawers",
            ),
            children=[
                LocationSuggestion(
                    name="Drawer 1",
                    location_type="drawer",
                    description="Top drawer",
                ),
                LocationSuggestion(
                    name="Drawer 2",
                    location_type="drawer",
                    description="Bottom drawer",
                ),
            ],
            confidence=0.85,
            reasoning="Identified a workbench with two visible drawers.",
        )

        assert result.parent.name == "Workbench"
        assert len(result.children) == 2
        assert result.confidence == 0.85
        assert "workbench" in result.reasoning.lower()

    def test_location_analysis_result_empty_children(self):
        """Test LocationAnalysisResult with no children."""
        result = LocationAnalysisResult(
            parent=LocationSuggestion(
                name="Storage Box",
                location_type="box",
                description=None,
            ),
            children=[],
            confidence=0.95,
            reasoning="Single storage box without compartments.",
        )

        assert result.parent.name == "Storage Box"
        assert len(result.children) == 0
        assert result.confidence == 0.95
