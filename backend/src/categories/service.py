import re
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.categories.models import Category
from src.categories.schemas import (
    AttributeField,
    CategoryCreate,
    CategoryTreeNode,
    CategoryUpdate,
    MergedAttributeTemplate,
)


def generate_path_segment(name: str) -> str:
    """
    Convert a name to an ltree-safe path segment.

    Examples:
        'Wood Screws' -> 'wood_screws'
        'M3 Bolts (Stainless)' -> 'm3_bolts_stainless'
    """
    segment = name.lower().strip()
    # Replace non-alphanumeric characters with underscores
    segment = re.sub(r"[^a-z0-9]+", "_", segment)
    # Remove leading/trailing underscores
    segment = segment.strip("_")
    # Ensure we have something
    return segment or "unnamed"


class CategoryService:
    """Service for category operations with hierarchy support."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def get_all(self) -> list[Category]:
        """Get all categories for the current user, ordered by path."""
        result = await self.session.execute(
            select(Category)
            .where(Category.user_id == self.user_id)
            .order_by(Category.path, Category.name)
        )
        return list(result.scalars().all())

    async def get_by_id(self, category_id: UUID) -> Category | None:
        """Get a category by ID."""
        result = await self.session.execute(
            select(Category).where(
                Category.id == category_id,
                Category.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Category | None:
        """Get a category by name."""
        result = await self.session.execute(
            select(Category).where(
                Category.name == name,
                Category.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_descendants(self, category: Category) -> list[Category]:
        """Get all descendants of a category using ltree."""
        if not category.path:
            return []

        # Use ltree descendant operator: path <@ parent_path
        result = await self.session.execute(
            select(Category).where(
                Category.user_id == self.user_id,
                Category.id != category.id,
                text("path <@ :parent_path").bindparams(parent_path=str(category.path)),
            )
        )
        return list(result.scalars().all())

    async def get_descendant_ids(self, category_id: UUID) -> list[UUID]:
        """Get IDs of all descendants of a category (including itself)."""
        category = await self.get_by_id(category_id)
        if not category:
            return []

        ids = [category.id]
        descendants = await self.get_descendants(category)
        ids.extend(d.id for d in descendants)
        return ids

    async def get_ancestors(self, category: Category) -> list[Category]:
        """Get all ancestors of a category (from root to parent)."""
        if not category.path or not category.parent_id:
            return []

        # Use ltree ancestor operator: path @> descendant_path
        result = await self.session.execute(
            select(Category)
            .where(
                Category.user_id == self.user_id,
                Category.id != category.id,
                text(":child_path <@ path").bindparams(child_path=str(category.path)),
            )
            .order_by(Category.path)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count categories for the current user."""
        result = await self.session.execute(
            select(func.count(Category.id)).where(Category.user_id == self.user_id)
        )
        return result.scalar_one()

    async def _build_path(self, name: str, parent_id: UUID | None) -> str:
        """Build the ltree path for a category."""
        segment = generate_path_segment(name)

        if parent_id:
            parent = await self.get_by_id(parent_id)
            if parent and parent.path:
                return f"{parent.path}.{segment}"

        return segment

    async def _ensure_unique_path(
        self, base_path: str, exclude_id: UUID | None = None
    ) -> str:
        """Ensure path is unique by adding a suffix if necessary."""
        path = base_path
        counter = 1

        while True:
            query = select(Category).where(
                Category.user_id == self.user_id,
                Category.path == text(f"'{path}'::ltree"),
            )
            if exclude_id:
                query = query.where(Category.id != exclude_id)

            result = await self.session.execute(query)
            if not result.scalar_one_or_none():
                return path

            counter += 1
            path = f"{base_path}_{counter}"

    async def create(self, data: CategoryCreate) -> Category:
        """Create a new category with proper path management."""
        # Build the path
        path = await self._build_path(data.name, data.parent_id)
        path = await self._ensure_unique_path(path)

        # Prepare attribute template
        template_dict = {}
        if data.attribute_template:
            template_dict = data.attribute_template.model_dump()

        category = Category(
            user_id=self.user_id,
            name=data.name,
            icon=data.icon,
            description=data.description,
            parent_id=data.parent_id,
            path=path,
            attribute_template=template_dict,
        )
        self.session.add(category)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def update(self, category: Category, data: CategoryUpdate) -> Category:
        """Update a category, handling path changes if parent or name changes."""
        update_data = data.model_dump(exclude_unset=True)

        # Check if we need to update the path
        name_changed = "name" in update_data and update_data["name"] != category.name
        parent_changed = (
            "parent_id" in update_data
            and update_data["parent_id"] != category.parent_id
        )

        if name_changed or parent_changed:
            new_name = update_data.get("name", category.name)
            new_parent_id = update_data.get("parent_id", category.parent_id)
            await self._update_paths(category, new_name, new_parent_id)

        # Handle attribute template
        if "attribute_template" in update_data:
            template = update_data.pop("attribute_template")
            if template is not None:
                category.attribute_template = (
                    template.model_dump()
                    if hasattr(template, "model_dump")
                    else template
                )
            else:
                category.attribute_template = {}

        # Update other fields
        for field, value in update_data.items():
            if field != "parent_id":  # parent_id handled in _update_paths
                setattr(category, field, value)

        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def _update_paths(
        self, category: Category, new_name: str, new_parent_id: UUID | None
    ) -> None:
        """Update paths for a category and all its descendants."""
        old_path = str(category.path) if category.path else ""

        # Build new path
        new_path = await self._build_path(new_name, new_parent_id)
        new_path = await self._ensure_unique_path(new_path, exclude_id=category.id)

        # Update this category
        category.parent_id = new_parent_id
        category.path = new_path

        # Update all descendants' paths
        if old_path:
            descendants = await self.get_descendants(category)
            for desc in descendants:
                if desc.path and str(desc.path).startswith(old_path):
                    desc.path = str(desc.path).replace(old_path, new_path, 1)

    async def move(self, category: Category, new_parent_id: UUID | None) -> Category:
        """Move a category to a new parent."""
        if new_parent_id:
            # Prevent moving to a descendant
            descendant_ids = await self.get_descendant_ids(category.id)
            if new_parent_id in descendant_ids:
                raise ValueError("Cannot move a category to one of its descendants")

        await self._update_paths(category, category.name, new_parent_id)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def delete(self, category: Category) -> None:
        """Delete a category. Children will have their parent_id set to NULL."""
        await self.session.delete(category)
        await self.session.commit()

    async def get_tree(self) -> list[CategoryTreeNode]:
        """Build a nested tree structure of all categories."""
        # Get all categories with item counts
        result = await self.session.execute(
            select(Category, func.count(Category.items).label("item_count"))
            .outerjoin(Category.items)
            .where(Category.user_id == self.user_id)
            .group_by(Category.id)
            .order_by(Category.path)
        )
        rows = result.all()

        # Build lookup maps
        nodes: dict[UUID, CategoryTreeNode] = {}
        for category, item_count in rows:
            nodes[category.id] = CategoryTreeNode(
                id=category.id,
                name=category.name,
                icon=category.icon,
                description=category.description,
                path=str(category.path) if category.path else "",
                attribute_template=category.attribute_template or {},
                item_count=item_count,
                children=[],
            )

        # Build tree structure
        roots: list[CategoryTreeNode] = []
        for category, _ in rows:
            node = nodes[category.id]
            if category.parent_id and category.parent_id in nodes:
                nodes[category.parent_id].children.append(node)
            else:
                roots.append(node)

        return roots

    async def get_merged_template(self, category_id: UUID) -> MergedAttributeTemplate:
        """
        Get merged attribute template from category and all ancestors.

        Fields from child categories override fields with the same name from parents.
        """
        category = await self.get_by_id(category_id)
        if not category:
            return MergedAttributeTemplate()

        # Get ancestors (ordered from root to parent)
        ancestors = await self.get_ancestors(category)

        # Merge templates: ancestors first, then current category
        all_categories = ancestors + [category]
        merged_fields: dict[str, AttributeField] = {}
        inherited_from: list[UUID] = []

        for cat in all_categories:
            template = cat.attribute_template or {}
            fields = template.get("fields", [])

            if fields:
                inherited_from.append(cat.id)
                for field_data in fields:
                    field = AttributeField(**field_data)
                    merged_fields[field.name] = field  # Later fields override earlier

        return MergedAttributeTemplate(
            fields=list(merged_fields.values()),
            inherited_from=inherited_from,
        )
