from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.gridfinity.models import GridfinityPlacement, GridfinityUnit
from src.gridfinity.schemas import (
    AutoLayoutPlacement,
    AutoLayoutResult,
    BinRecommendation,
    GridfinityPlacementCreate,
    GridfinityPlacementUpdate,
    GridfinityUnitCreate,
    GridfinityUnitUpdate,
)
from src.items.models import Item


class GridfinityService:
    """Service for Gridfinity storage planning operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    # Unit operations

    async def get_all_units(self) -> list[GridfinityUnit]:
        """Get all Gridfinity units for the current user."""
        result = await self.session.execute(
            select(GridfinityUnit)
            .where(GridfinityUnit.user_id == self.user_id)
            .order_by(GridfinityUnit.name)
        )
        return list(result.scalars().all())

    async def get_unit_by_id(self, unit_id: UUID) -> GridfinityUnit | None:
        """Get a unit by ID."""
        result = await self.session.execute(
            select(GridfinityUnit).where(
                GridfinityUnit.id == unit_id,
                GridfinityUnit.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_unit_by_name(self, name: str) -> GridfinityUnit | None:
        """Get a unit by name."""
        result = await self.session.execute(
            select(GridfinityUnit).where(
                GridfinityUnit.name == name,
                GridfinityUnit.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_unit_with_placements(self, unit_id: UUID) -> GridfinityUnit | None:
        """Get a unit with all its placements loaded."""
        result = await self.session.execute(
            select(GridfinityUnit)
            .options(selectinload(GridfinityUnit.placements))
            .where(
                GridfinityUnit.id == unit_id,
                GridfinityUnit.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def count_units(self) -> int:
        """Count units for the current user."""
        result = await self.session.execute(
            select(func.count(GridfinityUnit.id)).where(
                GridfinityUnit.user_id == self.user_id
            )
        )
        return result.scalar_one()

    async def create_unit(self, data: GridfinityUnitCreate) -> GridfinityUnit:
        """Create a new Gridfinity unit."""
        # Calculate grid size from dimensions
        grid_columns, grid_rows = GridfinityUnit.calculate_grid_size(
            data.container_width_mm, data.container_depth_mm
        )

        unit = GridfinityUnit(
            user_id=self.user_id,
            name=data.name,
            description=data.description,
            location_id=data.location_id,
            container_width_mm=data.container_width_mm,
            container_depth_mm=data.container_depth_mm,
            container_height_mm=data.container_height_mm,
            grid_columns=grid_columns,
            grid_rows=grid_rows,
        )
        self.session.add(unit)
        await self.session.commit()
        await self.session.refresh(unit)
        return unit

    async def update_unit(
        self, unit: GridfinityUnit, data: GridfinityUnitUpdate
    ) -> GridfinityUnit:
        """Update a Gridfinity unit."""
        update_data = data.model_dump(exclude_unset=True)

        # Check if dimensions changed - need to recalculate grid
        width = update_data.get("container_width_mm", unit.container_width_mm)
        depth = update_data.get("container_depth_mm", unit.container_depth_mm)

        if "container_width_mm" in update_data or "container_depth_mm" in update_data:
            grid_columns, grid_rows = GridfinityUnit.calculate_grid_size(width, depth)
            unit.grid_columns = grid_columns
            unit.grid_rows = grid_rows

        # Update other fields
        for field, value in update_data.items():
            setattr(unit, field, value)

        await self.session.commit()
        await self.session.refresh(unit)
        return unit

    async def delete_unit(self, unit: GridfinityUnit) -> None:
        """Delete a Gridfinity unit and all its placements."""
        await self.session.delete(unit)
        await self.session.commit()

    # Placement operations

    async def get_placement_by_id(
        self, placement_id: UUID
    ) -> GridfinityPlacement | None:
        """Get a placement by ID."""
        result = await self.session.execute(
            select(GridfinityPlacement).where(
                GridfinityPlacement.id == placement_id,
                GridfinityPlacement.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_placements_for_unit(self, unit_id: UUID) -> list[GridfinityPlacement]:
        """Get all placements for a unit."""
        result = await self.session.execute(
            select(GridfinityPlacement)
            .where(
                GridfinityPlacement.unit_id == unit_id,
                GridfinityPlacement.user_id == self.user_id,
            )
            .order_by(GridfinityPlacement.grid_y, GridfinityPlacement.grid_x)
        )
        return list(result.scalars().all())

    async def get_item_placements(self, item_id: UUID) -> list[GridfinityPlacement]:
        """Get all placements for an item across all units."""
        result = await self.session.execute(
            select(GridfinityPlacement).where(
                GridfinityPlacement.item_id == item_id,
                GridfinityPlacement.user_id == self.user_id,
            )
        )
        return list(result.scalars().all())

    async def create_placement(
        self, unit_id: UUID, data: GridfinityPlacementCreate
    ) -> GridfinityPlacement:
        """Create a new placement in a unit."""
        placement = GridfinityPlacement(
            user_id=self.user_id,
            unit_id=unit_id,
            item_id=data.item_id,
            grid_x=data.grid_x,
            grid_y=data.grid_y,
            width_units=data.width_units,
            depth_units=data.depth_units,
            bin_height_units=data.bin_height_units,
            notes=data.notes,
        )
        self.session.add(placement)
        await self.session.commit()
        await self.session.refresh(placement)
        return placement

    async def update_placement(
        self, placement: GridfinityPlacement, data: GridfinityPlacementUpdate
    ) -> GridfinityPlacement:
        """Update a placement."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(placement, field, value)

        await self.session.commit()
        await self.session.refresh(placement)
        return placement

    async def delete_placement(self, placement: GridfinityPlacement) -> None:
        """Delete a placement."""
        await self.session.delete(placement)
        await self.session.commit()

    # Validation

    def validate_placement_bounds(
        self,
        unit: GridfinityUnit,
        grid_x: int,
        grid_y: int,
        width_units: int,
        depth_units: int,
    ) -> bool:
        """Check if a placement fits within the unit bounds."""
        return (
            grid_x >= 0
            and grid_y >= 0
            and grid_x + width_units <= unit.grid_columns
            and grid_y + depth_units <= unit.grid_rows
        )

    def check_placement_overlap(
        self,
        existing_placements: list[GridfinityPlacement],
        grid_x: int,
        grid_y: int,
        width_units: int,
        depth_units: int,
        exclude_id: UUID | None = None,
    ) -> GridfinityPlacement | None:
        """Check if a placement would overlap with existing placements.

        Returns the overlapping placement if found, None otherwise.
        """
        new_x_end = grid_x + width_units
        new_y_end = grid_y + depth_units

        for placement in existing_placements:
            if exclude_id and placement.id == exclude_id:
                continue

            existing_x_end = placement.grid_x + placement.width_units
            existing_y_end = placement.grid_y + placement.depth_units

            # Check for overlap
            if (
                grid_x < existing_x_end
                and new_x_end > placement.grid_x
                and grid_y < existing_y_end
                and new_y_end > placement.grid_y
            ):
                return placement

        return None

    # Auto-layout algorithm

    async def auto_layout(
        self, unit: GridfinityUnit, item_ids: list[UUID]
    ) -> AutoLayoutResult:
        """Automatically place items in the unit using First-Fit Decreasing.

        Items are sorted by area (largest first) and placed in the first
        available position that fits.
        """
        # Get items with their dimensions from attributes
        items_result = await self.session.execute(
            select(Item).where(
                Item.id.in_(item_ids),
                Item.user_id == self.user_id,
            )
        )
        items = {item.id: item for item in items_result.scalars().all()}

        # Get existing placements
        existing = await self.get_placements_for_unit(unit.id)

        # Build grid occupancy map
        grid = [[False] * unit.grid_columns for _ in range(unit.grid_rows)]
        for p in existing:
            for dy in range(p.depth_units):
                for dx in range(p.width_units):
                    if (
                        p.grid_y + dy < unit.grid_rows
                        and p.grid_x + dx < unit.grid_columns
                    ):
                        grid[p.grid_y + dy][p.grid_x + dx] = True

        # Prepare items with estimated sizes
        items_to_place = []
        for item_id in item_ids:
            if item_id not in items:
                continue
            item = items[item_id]

            # Get dimensions from attributes or default to 1x1
            attrs = item.attributes or {}
            dims = attrs.get("dimensions", {})
            width_mm = dims.get("width_mm", 42)
            depth_mm = dims.get("depth_mm", 42)

            # Convert to grid units
            width_units = max(1, (width_mm + 41) // 42)  # Ceiling division
            depth_units = max(1, (depth_mm + 41) // 42)

            items_to_place.append(
                {
                    "item_id": item_id,
                    "width_units": width_units,
                    "depth_units": depth_units,
                    "area": width_units * depth_units,
                }
            )

        # Sort by area (largest first) - First-Fit Decreasing
        items_to_place.sort(key=lambda x: x["area"], reverse=True)

        placed = []
        unplaced = []

        for item_data in items_to_place:
            position = self._find_first_fit(
                grid,
                unit.grid_rows,
                unit.grid_columns,
                item_data["width_units"],
                item_data["depth_units"],
            )

            if position:
                x, y = position
                # Mark cells as occupied
                for dy in range(item_data["depth_units"]):
                    for dx in range(item_data["width_units"]):
                        grid[y + dy][x + dx] = True

                placed.append(
                    AutoLayoutPlacement(
                        item_id=item_data["item_id"],
                        grid_x=x,
                        grid_y=y,
                        width_units=item_data["width_units"],
                        depth_units=item_data["depth_units"],
                    )
                )
            else:
                unplaced.append(item_data["item_id"])

        # Calculate utilization
        total_cells = unit.grid_rows * unit.grid_columns
        occupied_cells = sum(row.count(True) for row in grid)
        utilization = (occupied_cells / total_cells * 100) if total_cells > 0 else 0

        return AutoLayoutResult(
            placed=placed,
            unplaced=unplaced,
            utilization_percent=round(utilization, 1),
        )

    def _find_first_fit(
        self,
        grid: list[list[bool]],
        rows: int,
        cols: int,
        width: int,
        depth: int,
    ) -> tuple[int, int] | None:
        """Find the first position where an item fits."""
        for y in range(rows - depth + 1):
            for x in range(cols - width + 1):
                if self._can_place(grid, x, y, width, depth):
                    return (x, y)
        return None

    def _can_place(
        self,
        grid: list[list[bool]],
        x: int,
        y: int,
        width: int,
        depth: int,
    ) -> bool:
        """Check if an item can be placed at the given position."""
        for dy in range(depth):
            for dx in range(width):
                if grid[y + dy][x + dx]:
                    return False
        return True

    # Bin recommendations

    async def recommend_bin_sizes(
        self, item_ids: list[UUID]
    ) -> list[BinRecommendation]:
        """Recommend bin sizes for items based on their dimensions."""
        items_result = await self.session.execute(
            select(Item).where(
                Item.id.in_(item_ids),
                Item.user_id == self.user_id,
            )
        )
        items = list(items_result.scalars().all())

        recommendations = []
        for item in items:
            attrs = item.attributes or {}
            dims = attrs.get("dimensions", {})

            width_mm = dims.get("width_mm")
            depth_mm = dims.get("depth_mm")
            height_mm = dims.get("height_mm")

            if width_mm and depth_mm:
                # Calculate required grid units (ceiling)
                width_units = max(1, (width_mm + 41) // 42)
                depth_units = max(1, (depth_mm + 41) // 42)
                height_units = None

                if height_mm:
                    # Gridfinity height unit is 7mm
                    height_units = max(1, (height_mm + 6) // 7)

                reasoning = (
                    f"Item dimensions ({width_mm}x{depth_mm}mm) require "
                    f"{width_units}x{depth_units} grid units"
                )
                if height_units:
                    reasoning += f", {height_units}u height ({height_mm}mm)"

                recommendations.append(
                    BinRecommendation(
                        item_id=item.id,
                        item_name=item.name,
                        recommended_width_units=width_units,
                        recommended_depth_units=depth_units,
                        recommended_height_units=height_units,
                        reasoning=reasoning,
                    )
                )
            else:
                recommendations.append(
                    BinRecommendation(
                        item_id=item.id,
                        item_name=item.name,
                        recommended_width_units=1,
                        recommended_depth_units=1,
                        recommended_height_units=None,
                        reasoning="No dimensions set - defaulting to 1x1 bin",
                    )
                )

        return recommendations
