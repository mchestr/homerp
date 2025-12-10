import re
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.locations.models import Location
from src.locations.schemas import (
    LocationCreate,
    LocationTreeNode,
    LocationUpdate,
)


def generate_path_segment(name: str) -> str:
    """
    Convert a name to an ltree-safe path segment.

    Examples:
        'Red Toolbox' -> 'red_toolbox'
        'Drawer 1 (Top)' -> 'drawer_1_top'
    """
    segment = name.lower().strip()
    # Replace non-alphanumeric characters with underscores
    segment = re.sub(r"[^a-z0-9]+", "_", segment)
    # Remove leading/trailing underscores
    segment = segment.strip("_")
    # Ensure we have something
    return segment or "unnamed"


class LocationService:
    """Service for location operations with hierarchy support."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def get_all(self) -> list[Location]:
        """Get all locations for the current user, ordered by path."""
        result = await self.session.execute(
            select(Location)
            .where(Location.user_id == self.user_id)
            .order_by(Location.path, Location.name)
        )
        return list(result.scalars().all())

    async def get_by_id(self, location_id: UUID) -> Location | None:
        """Get a location by ID."""
        result = await self.session.execute(
            select(Location).where(
                Location.id == location_id,
                Location.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Location | None:
        """Get a location by name."""
        result = await self.session.execute(
            select(Location).where(
                Location.name == name,
                Location.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_descendants(self, location: Location) -> list[Location]:
        """Get all descendants of a location using ltree."""
        if not location.path:
            return []

        # Use ltree descendant operator: path <@ parent_path
        result = await self.session.execute(
            select(Location).where(
                Location.user_id == self.user_id,
                Location.id != location.id,
                text("path <@ :parent_path").bindparams(parent_path=str(location.path)),
            )
        )
        return list(result.scalars().all())

    async def get_descendant_ids(self, location_id: UUID) -> list[UUID]:
        """Get IDs of all descendants of a location (including itself)."""
        location = await self.get_by_id(location_id)
        if not location:
            return []

        ids = [location.id]
        descendants = await self.get_descendants(location)
        ids.extend(d.id for d in descendants)
        return ids

    async def get_ancestors(self, location: Location) -> list[Location]:
        """Get all ancestors of a location (from root to parent)."""
        if not location.path or not location.parent_id:
            return []

        # Use ltree ancestor operator
        result = await self.session.execute(
            select(Location)
            .where(
                Location.user_id == self.user_id,
                Location.id != location.id,
                text(":child_path <@ path").bindparams(child_path=str(location.path)),
            )
            .order_by(Location.path)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count locations for the current user."""
        result = await self.session.execute(
            select(func.count(Location.id)).where(Location.user_id == self.user_id)
        )
        return result.scalar_one()

    async def _build_path(self, name: str, parent_id: UUID | None) -> str:
        """Build the ltree path for a location."""
        segment = generate_path_segment(name)

        if parent_id:
            parent = await self.get_by_id(parent_id)
            if parent and parent.path:
                return f"{parent.path}.{segment}"

        return segment

    async def _ensure_unique_path(self, base_path: str, exclude_id: UUID | None = None) -> str:
        """Ensure path is unique by adding a suffix if necessary."""
        path = base_path
        counter = 1

        while True:
            query = select(Location).where(
                Location.user_id == self.user_id,
                Location.path == text(f"'{path}'::ltree"),
            )
            if exclude_id:
                query = query.where(Location.id != exclude_id)

            result = await self.session.execute(query)
            if not result.scalar_one_or_none():
                return path

            counter += 1
            path = f"{base_path}_{counter}"

    async def create(self, data: LocationCreate) -> Location:
        """Create a new location with proper path management."""
        # Build the path
        path = await self._build_path(data.name, data.parent_id)
        path = await self._ensure_unique_path(path)

        location = Location(
            user_id=self.user_id,
            name=data.name,
            description=data.description,
            location_type=data.location_type,
            parent_id=data.parent_id,
            path=path,
        )
        self.session.add(location)
        await self.session.commit()
        await self.session.refresh(location)
        return location

    async def update(self, location: Location, data: LocationUpdate) -> Location:
        """Update a location, handling path changes if parent or name changes."""
        update_data = data.model_dump(exclude_unset=True)

        # Check if we need to update the path
        name_changed = "name" in update_data and update_data["name"] != location.name
        parent_changed = "parent_id" in update_data and update_data["parent_id"] != location.parent_id

        if name_changed or parent_changed:
            new_name = update_data.get("name", location.name)
            new_parent_id = update_data.get("parent_id", location.parent_id)
            await self._update_paths(location, new_name, new_parent_id)

        # Update other fields
        for field, value in update_data.items():
            if field != "parent_id":  # parent_id handled in _update_paths
                setattr(location, field, value)

        await self.session.commit()
        await self.session.refresh(location)
        return location

    async def _update_paths(
        self, location: Location, new_name: str, new_parent_id: UUID | None
    ) -> None:
        """Update paths for a location and all its descendants."""
        old_path = str(location.path) if location.path else ""

        # Build new path
        new_path = await self._build_path(new_name, new_parent_id)
        new_path = await self._ensure_unique_path(new_path, exclude_id=location.id)

        # Update this location
        location.parent_id = new_parent_id
        location.path = new_path

        # Update all descendants' paths
        if old_path:
            descendants = await self.get_descendants(location)
            for desc in descendants:
                if desc.path and str(desc.path).startswith(old_path):
                    desc.path = str(desc.path).replace(old_path, new_path, 1)

    async def move(self, location: Location, new_parent_id: UUID | None) -> Location:
        """Move a location to a new parent."""
        if new_parent_id:
            # Prevent moving to a descendant
            descendant_ids = await self.get_descendant_ids(location.id)
            if new_parent_id in descendant_ids:
                raise ValueError("Cannot move a location to one of its descendants")

        await self._update_paths(location, location.name, new_parent_id)
        await self.session.commit()
        await self.session.refresh(location)
        return location

    async def delete(self, location: Location) -> None:
        """Delete a location. Children will have their parent_id set to NULL."""
        await self.session.delete(location)
        await self.session.commit()

    async def get_tree(self) -> list[LocationTreeNode]:
        """Build a nested tree structure of all locations."""
        # Get all locations with item counts
        result = await self.session.execute(
            select(Location, func.count(Location.items).label("item_count"))
            .outerjoin(Location.items)
            .where(Location.user_id == self.user_id)
            .group_by(Location.id)
            .order_by(Location.path)
        )
        rows = result.all()

        # Build lookup maps
        nodes: dict[UUID, LocationTreeNode] = {}
        for location, item_count in rows:
            nodes[location.id] = LocationTreeNode(
                id=location.id,
                name=location.name,
                description=location.description,
                location_type=location.location_type,
                path=str(location.path) if location.path else "",
                item_count=item_count,
                children=[],
            )

        # Build tree structure
        roots: list[LocationTreeNode] = []
        for location, _ in rows:
            node = nodes[location.id]
            if location.parent_id and location.parent_id in nodes:
                nodes[location.parent_id].children.append(node)
            else:
                roots.append(node)

        return roots

    async def get_path_display(self, location: Location) -> str:
        """Get a human-readable path like 'Garage > Red Toolbox > Drawer 1'."""
        ancestors = await self.get_ancestors(location)
        names = [a.name for a in ancestors] + [location.name]
        return " > ".join(names)
