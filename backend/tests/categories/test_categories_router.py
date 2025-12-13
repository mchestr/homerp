"""HTTP integration tests for categories router."""

import uuid

from httpx import AsyncClient

from src.categories.models import Category


class TestListCategoriesEndpoint:
    """Tests for GET /api/v1/categories."""

    async def test_list_categories_empty(self, authenticated_client: AsyncClient):
        """Test listing categories when none exist."""
        response = await authenticated_client.get("/api/v1/categories")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_categories_with_data(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test listing categories with existing data."""
        response = await authenticated_client.get("/api/v1/categories")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_category.name

    async def test_list_categories_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/categories")

        assert response.status_code == 401


class TestGetCategoryTreeEndpoint:
    """Tests for GET /api/v1/categories/tree."""

    async def test_get_category_tree_empty(self, authenticated_client: AsyncClient):
        """Test getting tree when no categories exist."""
        response = await authenticated_client.get("/api/v1/categories/tree")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_get_category_tree_with_data(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test getting category tree with data."""
        response = await authenticated_client.get("/api/v1/categories/tree")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_category.name


class TestCreateCategoryEndpoint:
    """Tests for POST /api/v1/categories."""

    async def test_create_category(self, authenticated_client: AsyncClient):
        """Test creating a new category."""
        response = await authenticated_client.post(
            "/api/v1/categories",
            json={
                "name": "Tools",
                "description": "All tools",
                "attribute_template": {
                    "fields": [
                        {"name": "brand", "label": "Brand", "type": "text"}
                    ]
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Tools"
        assert data["description"] == "All tools"

    async def test_create_category_with_parent(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test creating a category with a parent."""
        response = await authenticated_client.post(
            "/api/v1/categories",
            json={"name": "Subcategory", "parent_id": str(test_category.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["parent_id"] == str(test_category.id)

    async def test_create_category_duplicate_name(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test creating a category with duplicate name."""
        response = await authenticated_client.post(
            "/api/v1/categories", json={"name": test_category.name}
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    async def test_create_category_invalid_parent(
        self, authenticated_client: AsyncClient
    ):
        """Test creating a category with non-existent parent."""
        response = await authenticated_client.post(
            "/api/v1/categories",
            json={"name": "Test", "parent_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404
        assert "Parent category not found" in response.json()["detail"]

    async def test_create_category_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/categories", json={"name": "Test"}
        )

        assert response.status_code == 401


class TestCreateCategoryFromPathEndpoint:
    """Tests for POST /api/v1/categories/from-path."""

    async def test_create_from_path(self, authenticated_client: AsyncClient):
        """Test creating categories from path."""
        response = await authenticated_client.post(
            "/api/v1/categories/from-path",
            json={"path": "Hardware > Fasteners > Screws"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Screws"

    async def test_create_from_path_single_level(
        self, authenticated_client: AsyncClient
    ):
        """Test creating single-level category from path."""
        response = await authenticated_client.post(
            "/api/v1/categories/from-path", json={"path": "SimpleCategory"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "SimpleCategory"


class TestGetCategoryEndpoint:
    """Tests for GET /api/v1/categories/{category_id}."""

    async def test_get_category(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test getting a category by ID."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{test_category.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_category.id)
        assert data["name"] == test_category.name

    async def test_get_category_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent category."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{uuid.uuid4()}"
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Category not found"


class TestGetCategoryTemplateEndpoint:
    """Tests for GET /api/v1/categories/{category_id}/template."""

    async def test_get_category_template(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test getting category template."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{test_category.id}/template"
        )

        assert response.status_code == 200
        data = response.json()
        assert "fields" in data

    async def test_get_category_template_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test getting template for non-existent category."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{uuid.uuid4()}/template"
        )

        assert response.status_code == 404


class TestGetCategoryDescendantsEndpoint:
    """Tests for GET /api/v1/categories/{category_id}/descendants."""

    async def test_get_descendants(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test getting category descendants."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{test_category.id}/descendants"
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_descendants_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test getting descendants for non-existent category."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{uuid.uuid4()}/descendants"
        )

        assert response.status_code == 404


class TestUpdateCategoryEndpoint:
    """Tests for PUT /api/v1/categories/{category_id}."""

    async def test_update_category(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test updating a category."""
        response = await authenticated_client.put(
            f"/api/v1/categories/{test_category.id}",
            json={"name": "Updated Name", "description": "Updated description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"

    async def test_update_category_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test updating a non-existent category."""
        response = await authenticated_client.put(
            f"/api/v1/categories/{uuid.uuid4()}", json={"name": "Test"}
        )

        assert response.status_code == 404


class TestMoveCategoryEndpoint:
    """Tests for PATCH /api/v1/categories/{category_id}/move."""

    async def test_move_category_to_root(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test moving a category to root level."""
        response = await authenticated_client.patch(
            f"/api/v1/categories/{test_category.id}/move",
            json={"new_parent_id": None},
        )

        assert response.status_code == 200

    async def test_move_category_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test moving a non-existent category."""
        response = await authenticated_client.patch(
            f"/api/v1/categories/{uuid.uuid4()}/move", json={"new_parent_id": None}
        )

        assert response.status_code == 404


class TestDeleteCategoryEndpoint:
    """Tests for DELETE /api/v1/categories/{category_id}."""

    async def test_delete_category(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test deleting a category."""
        response = await authenticated_client.delete(
            f"/api/v1/categories/{test_category.id}"
        )

        assert response.status_code == 204

        # Verify category is deleted
        get_response = await authenticated_client.get(
            f"/api/v1/categories/{test_category.id}"
        )
        assert get_response.status_code == 404

    async def test_delete_category_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test deleting a non-existent category."""
        response = await authenticated_client.delete(
            f"/api/v1/categories/{uuid.uuid4()}"
        )

        assert response.status_code == 404
