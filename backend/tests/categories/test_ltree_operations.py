"""Tests for category ltree operations.

These tests ensure that hierarchical category operations work correctly
with PostgreSQL's ltree type.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.categories.models import Category
from src.categories.schemas import CategoryCreate, CategoryResponse, CategoryTreeNode
from src.categories.service import CategoryService
from src.users.models import User


@pytest.fixture
async def category_service(
    async_session: AsyncSession, test_user: User
) -> CategoryService:
    """Create a category service for testing."""
    return CategoryService(async_session, test_user.id)


@pytest.fixture
async def root_category(
    async_session: AsyncSession, category_service: CategoryService
) -> Category:
    """Create a root category."""
    category = await category_service.create(
        CategoryCreate(name="Electronics", icon="🔌", description="Electronic items")
    )
    await async_session.commit()
    return category


@pytest.fixture
async def child_category(
    async_session: AsyncSession,
    category_service: CategoryService,
    root_category: Category,
) -> Category:
    """Create a child category."""
    category = await category_service.create(
        CategoryCreate(
            name="Components",
            icon="🔧",
            description="Electronic components",
            parent_id=root_category.id,
        )
    )
    await async_session.commit()
    return category


@pytest.fixture
async def grandchild_category(
    async_session: AsyncSession,
    category_service: CategoryService,
    child_category: Category,
) -> Category:
    """Create a grandchild category."""
    category = await category_service.create(
        CategoryCreate(
            name="Resistors",
            icon="⚡",
            description="Resistor components",
            parent_id=child_category.id,
        )
    )
    await async_session.commit()
    return category


class TestCategoryCreation:
    """Tests for category creation with ltree paths."""

    async def test_create_root_category(
        self, category_service: CategoryService, async_session: AsyncSession
    ):
        """Test creating a root category generates correct path."""
        category = await category_service.create(
            CategoryCreate(name="Tools", icon="🔨")
        )
        await async_session.commit()

        assert category.path is not None
        assert str(category.path) == "tools"
        assert category.parent_id is None

    async def test_create_child_category(
        self,
        category_service: CategoryService,
        root_category: Category,
        async_session: AsyncSession,
    ):
        """Test creating a child category generates correct hierarchical path."""
        category = await category_service.create(
            CategoryCreate(
                name="Capacitors",
                icon="⚡",
                parent_id=root_category.id,
            )
        )
        await async_session.commit()

        assert category.path is not None
        path_str = str(category.path)
        assert path_str == "electronics.capacitors"
        assert category.parent_id == root_category.id

    async def test_create_deeply_nested_category(
        self,
        category_service: CategoryService,
        grandchild_category: Category,
        async_session: AsyncSession,
    ):
        """Test creating deeply nested categories generates correct path."""
        category = await category_service.create(
            CategoryCreate(
                name="10K Ohm",
                icon="📦",
                parent_id=grandchild_category.id,
            )
        )
        await async_session.commit()

        assert category.path is not None
        path_str = str(category.path)
        assert path_str == "electronics.components.resistors.10k_ohm"


class TestCategoryDescendants:
    """Tests for getting category descendants using ltree."""

    async def test_get_descendants_returns_all_children(
        self,
        category_service: CategoryService,
        root_category: Category,
        child_category: Category,
        grandchild_category: Category,
    ):
        """Test get_descendants returns all descendant categories."""
        descendants = await category_service.get_descendants(root_category)

        assert len(descendants) == 2
        descendant_ids = {d.id for d in descendants}
        assert child_category.id in descendant_ids
        assert grandchild_category.id in descendant_ids

    async def test_get_descendants_excludes_self(
        self,
        category_service: CategoryService,
        root_category: Category,
        child_category: Category,  # noqa: ARG002
    ):
        """Test get_descendants does not include the category itself."""
        descendants = await category_service.get_descendants(root_category)

        descendant_ids = {d.id for d in descendants}
        assert root_category.id not in descendant_ids

    async def test_get_descendants_empty_for_leaf(
        self,
        category_service: CategoryService,
        grandchild_category: Category,
    ):
        """Test get_descendants returns empty list for leaf category."""
        descendants = await category_service.get_descendants(grandchild_category)

        assert len(descendants) == 0

    async def test_get_descendant_ids_includes_self(
        self,
        category_service: CategoryService,
        root_category: Category,
        child_category: Category,
        grandchild_category: Category,
    ):
        """Test get_descendant_ids includes the category itself."""
        ids = await category_service.get_descendant_ids(root_category.id)

        assert len(ids) == 3
        assert root_category.id in ids
        assert child_category.id in ids
        assert grandchild_category.id in ids


class TestCategoryAncestors:
    """Tests for getting category ancestors using ltree."""

    async def test_get_ancestors_returns_all_parents(
        self,
        category_service: CategoryService,
        root_category: Category,
        child_category: Category,
        grandchild_category: Category,
    ):
        """Test get_ancestors returns all ancestor categories."""
        ancestors = await category_service.get_ancestors(grandchild_category)

        assert len(ancestors) == 2
        ancestor_ids = {a.id for a in ancestors}
        assert root_category.id in ancestor_ids
        assert child_category.id in ancestor_ids

    async def test_get_ancestors_ordered_root_to_parent(
        self,
        category_service: CategoryService,
        root_category: Category,
        child_category: Category,
        grandchild_category: Category,
    ):
        """Test get_ancestors returns ancestors in order from root to parent."""
        ancestors = await category_service.get_ancestors(grandchild_category)

        assert len(ancestors) == 2
        assert ancestors[0].id == root_category.id
        assert ancestors[1].id == child_category.id

    async def test_get_ancestors_excludes_self(
        self,
        category_service: CategoryService,
        grandchild_category: Category,
    ):
        """Test get_ancestors does not include the category itself."""
        ancestors = await category_service.get_ancestors(grandchild_category)

        ancestor_ids = {a.id for a in ancestors}
        assert grandchild_category.id not in ancestor_ids

    async def test_get_ancestors_empty_for_root(
        self,
        category_service: CategoryService,
        root_category: Category,
    ):
        """Test get_ancestors returns empty list for root category."""
        ancestors = await category_service.get_ancestors(root_category)

        assert len(ancestors) == 0


class TestCategorySchemaLtreeSerialization:
    """Tests for Pydantic schema serialization of ltree fields."""

    async def test_category_response_serializes_path(
        self,
        root_category: Category,
    ):
        """Test CategoryResponse correctly serializes ltree path to string."""
        response = CategoryResponse.model_validate(root_category)

        assert isinstance(response.path, str)
        assert response.path == "electronics"

    async def test_category_response_handles_nested_path(
        self,
        grandchild_category: Category,
    ):
        """Test CategoryResponse correctly serializes nested ltree path."""
        response = CategoryResponse.model_validate(grandchild_category)

        assert isinstance(response.path, str)
        assert response.path == "electronics.components.resistors"

    async def test_category_tree_node_serializes_path(
        self,
        root_category: Category,
    ):
        """Test CategoryTreeNode correctly serializes ltree path to string."""
        node = CategoryTreeNode(
            id=root_category.id,
            name=root_category.name,
            icon=root_category.icon,
            description=root_category.description,
            path=root_category.path,
            attribute_template=root_category.attribute_template or {},
        )

        assert isinstance(node.path, str)
        assert node.path == "electronics"


class TestCategoryMergedTemplate:
    """Tests for merged attribute templates from category hierarchy."""

    async def test_get_merged_template_with_hierarchy(
        self,
        category_service: CategoryService,
        async_session: AsyncSession,
        test_user: User,  # noqa: ARG002
    ):
        """Test merged template includes fields from ancestors."""
        # Create parent with template
        parent = await category_service.create(
            CategoryCreate(
                name="Hardware",
                attribute_template={
                    "fields": [
                        {"name": "material", "label": "Material", "type": "text"}
                    ]
                },
            )
        )
        await async_session.commit()

        # Create child with its own template
        child = await category_service.create(
            CategoryCreate(
                name="Fasteners",
                parent_id=parent.id,
                attribute_template={
                    "fields": [{"name": "size", "label": "Size", "type": "text"}]
                },
            )
        )
        await async_session.commit()

        # Get merged template
        merged = await category_service.get_merged_template(child.id)

        field_names = {f.name for f in merged.fields}
        assert "material" in field_names
        assert "size" in field_names
        assert len(merged.inherited_from) == 2


class TestCategoryCreateFromPath:
    """Tests for creating categories from AI-suggested paths."""

    async def test_create_from_path_creates_hierarchy(
        self,
        category_service: CategoryService,
        async_session: AsyncSession,
    ):
        """Test create_from_path creates full category hierarchy."""
        leaf = await category_service.create_from_path(
            "Hardware > Fasteners > Screws > Wood Screws"
        )
        await async_session.commit()

        assert leaf.name == "Wood Screws"

        # Verify full hierarchy was created
        ancestors = await category_service.get_ancestors(leaf)
        ancestor_names = [a.name for a in ancestors]

        assert "Hardware" in ancestor_names
        assert "Fasteners" in ancestor_names
        assert "Screws" in ancestor_names

    async def test_create_from_path_reuses_existing(
        self,
        category_service: CategoryService,
        async_session: AsyncSession,
    ):
        """Test create_from_path reuses existing categories."""
        # Create first path
        await category_service.create_from_path("Electronics > Components")
        await async_session.commit()

        # Create second path that shares prefix
        await category_service.create_from_path("Electronics > Components > Capacitors")
        await async_session.commit()

        # Should only have one "Electronics" and one "Components"
        all_categories = await category_service.get_all()
        electronics_count = sum(1 for c in all_categories if c.name == "Electronics")
        components_count = sum(1 for c in all_categories if c.name == "Components")

        assert electronics_count == 1
        assert components_count == 1
