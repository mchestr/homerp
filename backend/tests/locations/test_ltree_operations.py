"""Tests for location ltree operations.

These tests ensure that hierarchical location operations work correctly
with PostgreSQL's ltree type.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.locations.models import Location
from src.locations.schemas import LocationCreate, LocationResponse, LocationTreeNode
from src.locations.service import LocationService
from src.users.models import User


@pytest.fixture
async def location_service(
    async_session: AsyncSession, test_user: User
) -> LocationService:
    """Create a location service for testing."""
    return LocationService(async_session, test_user.id)


@pytest.fixture
async def root_location(
    async_session: AsyncSession, location_service: LocationService
) -> Location:
    """Create a root location."""
    location = await location_service.create(
        LocationCreate(name="Garage", description="Main garage", location_type="room")
    )
    await async_session.commit()
    return location


@pytest.fixture
async def child_location(
    async_session: AsyncSession,
    location_service: LocationService,
    root_location: Location,
) -> Location:
    """Create a child location."""
    location = await location_service.create(
        LocationCreate(
            name="Workbench",
            description="Garage workbench",
            location_type="shelf",
            parent_id=root_location.id,
        )
    )
    await async_session.commit()
    return location


@pytest.fixture
async def grandchild_location(
    async_session: AsyncSession,
    location_service: LocationService,
    child_location: Location,
) -> Location:
    """Create a grandchild location."""
    location = await location_service.create(
        LocationCreate(
            name="Top Drawer",
            description="Top drawer of workbench",
            location_type="drawer",
            parent_id=child_location.id,
        )
    )
    await async_session.commit()
    return location


class TestLocationCreation:
    """Tests for location creation with ltree paths."""

    async def test_create_root_location(
        self, location_service: LocationService, async_session: AsyncSession
    ):
        """Test creating a root location generates correct path."""
        location = await location_service.create(
            LocationCreate(name="Basement", location_type="room")
        )
        await async_session.commit()

        assert location.path is not None
        assert str(location.path) == "basement"
        assert location.parent_id is None

    async def test_create_child_location(
        self,
        location_service: LocationService,
        root_location: Location,
        async_session: AsyncSession,
    ):
        """Test creating a child location generates correct hierarchical path."""
        location = await location_service.create(
            LocationCreate(
                name="Tool Cabinet",
                location_type="shelf",
                parent_id=root_location.id,
            )
        )
        await async_session.commit()

        assert location.path is not None
        path_str = str(location.path)
        assert path_str == "garage.tool_cabinet"
        assert location.parent_id == root_location.id

    async def test_create_deeply_nested_location(
        self,
        location_service: LocationService,
        grandchild_location: Location,
        async_session: AsyncSession,
    ):
        """Test creating deeply nested locations generates correct path."""
        location = await location_service.create(
            LocationCreate(
                name="Small Parts Bin",
                location_type="bin",
                parent_id=grandchild_location.id,
            )
        )
        await async_session.commit()

        assert location.path is not None
        path_str = str(location.path)
        assert path_str == "garage.workbench.top_drawer.small_parts_bin"


class TestLocationDescendants:
    """Tests for getting location descendants using ltree."""

    async def test_get_descendants_returns_all_children(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,
        grandchild_location: Location,
    ):
        """Test get_descendants returns all descendant locations."""
        descendants = await location_service.get_descendants(root_location)

        assert len(descendants) == 2
        descendant_ids = {d.id for d in descendants}
        assert child_location.id in descendant_ids
        assert grandchild_location.id in descendant_ids

    async def test_get_descendants_excludes_self(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,  # noqa: ARG002
    ):
        """Test get_descendants does not include the location itself."""
        descendants = await location_service.get_descendants(root_location)

        descendant_ids = {d.id for d in descendants}
        assert root_location.id not in descendant_ids

    async def test_get_descendants_empty_for_leaf(
        self,
        location_service: LocationService,
        grandchild_location: Location,
    ):
        """Test get_descendants returns empty list for leaf location."""
        descendants = await location_service.get_descendants(grandchild_location)

        assert len(descendants) == 0

    async def test_get_descendant_ids_includes_self(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,
        grandchild_location: Location,
    ):
        """Test get_descendant_ids includes the location itself."""
        ids = await location_service.get_descendant_ids(root_location.id)

        assert len(ids) == 3
        assert root_location.id in ids
        assert child_location.id in ids
        assert grandchild_location.id in ids


class TestLocationAncestors:
    """Tests for getting location ancestors using ltree."""

    async def test_get_ancestors_returns_all_parents(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,
        grandchild_location: Location,
    ):
        """Test get_ancestors returns all ancestor locations."""
        ancestors = await location_service.get_ancestors(grandchild_location)

        assert len(ancestors) == 2
        ancestor_ids = {a.id for a in ancestors}
        assert root_location.id in ancestor_ids
        assert child_location.id in ancestor_ids

    async def test_get_ancestors_ordered_root_to_parent(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,
        grandchild_location: Location,
    ):
        """Test get_ancestors returns ancestors in order from root to parent."""
        ancestors = await location_service.get_ancestors(grandchild_location)

        assert len(ancestors) == 2
        assert ancestors[0].id == root_location.id
        assert ancestors[1].id == child_location.id

    async def test_get_ancestors_excludes_self(
        self,
        location_service: LocationService,
        grandchild_location: Location,
    ):
        """Test get_ancestors does not include the location itself."""
        ancestors = await location_service.get_ancestors(grandchild_location)

        ancestor_ids = {a.id for a in ancestors}
        assert grandchild_location.id not in ancestor_ids

    async def test_get_ancestors_empty_for_root(
        self,
        location_service: LocationService,
        root_location: Location,
    ):
        """Test get_ancestors returns empty list for root location."""
        ancestors = await location_service.get_ancestors(root_location)

        assert len(ancestors) == 0


class TestLocationSchemaLtreeSerialization:
    """Tests for Pydantic schema serialization of ltree fields."""

    async def test_location_response_serializes_path(
        self,
        root_location: Location,
    ):
        """Test LocationResponse correctly serializes ltree path to string."""
        response = LocationResponse.model_validate(root_location)

        assert isinstance(response.path, str)
        assert response.path == "garage"

    async def test_location_response_handles_nested_path(
        self,
        grandchild_location: Location,
    ):
        """Test LocationResponse correctly serializes nested ltree path."""
        response = LocationResponse.model_validate(grandchild_location)

        assert isinstance(response.path, str)
        assert response.path == "garage.workbench.top_drawer"

    async def test_location_tree_node_serializes_path(
        self,
        root_location: Location,
    ):
        """Test LocationTreeNode correctly serializes ltree path to string."""
        node = LocationTreeNode(
            id=root_location.id,
            name=root_location.name,
            description=root_location.description,
            location_type=root_location.location_type,
            path=root_location.path,
        )

        assert isinstance(node.path, str)
        assert node.path == "garage"


class TestLocationUniquePathHandling:
    """Tests for unique path generation."""

    async def test_unique_names_get_unique_paths(
        self,
        location_service: LocationService,
        async_session: AsyncSession,
    ):
        """Test that locations with different names get unique paths."""
        loc1 = await location_service.create(
            LocationCreate(name="Storage Room", location_type="room")
        )
        await async_session.commit()

        loc2 = await location_service.create(
            LocationCreate(name="Tool Shed", location_type="room")
        )
        await async_session.commit()

        # Paths should be different
        assert str(loc1.path) != str(loc2.path)
        assert str(loc1.path) == "storage_room"
        assert str(loc2.path) == "tool_shed"

    async def test_child_locations_get_hierarchical_paths(
        self,
        location_service: LocationService,
        root_location: Location,
        async_session: AsyncSession,
    ):
        """Test that child locations get properly nested paths."""
        loc1 = await location_service.create(
            LocationCreate(
                name="Shelf A",
                location_type="shelf",
                parent_id=root_location.id,
            )
        )
        await async_session.commit()

        loc2 = await location_service.create(
            LocationCreate(
                name="Shelf B",
                location_type="shelf",
                parent_id=root_location.id,
            )
        )
        await async_session.commit()

        # Paths should be hierarchical and different
        assert str(loc1.path) != str(loc2.path)
        assert str(loc1.path) == "garage.shelf_a"
        assert str(loc2.path) == "garage.shelf_b"


class TestLocationTree:
    """Tests for building location tree structures."""

    async def test_get_tree_returns_hierarchical_structure(
        self,
        location_service: LocationService,
        root_location: Location,
        child_location: Location,
        grandchild_location: Location,
    ):
        """Test get_tree returns properly nested tree structure."""
        tree = await location_service.get_tree()

        # Should have one root node
        assert len(tree) >= 1

        # Find our test tree
        garage_node = next((n for n in tree if n.id == root_location.id), None)
        assert garage_node is not None
        assert garage_node.name == "Garage"

        # Check children
        assert len(garage_node.children) == 1
        workbench_node = garage_node.children[0]
        assert workbench_node.id == child_location.id
        assert workbench_node.name == "Workbench"

        # Check grandchildren
        assert len(workbench_node.children) == 1
        drawer_node = workbench_node.children[0]
        assert drawer_node.id == grandchild_location.id
        assert drawer_node.name == "Top Drawer"
