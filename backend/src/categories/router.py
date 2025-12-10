from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import CurrentUserIdDep
from src.categories.schemas import (
    CategoryCreate,
    CategoryMoveRequest,
    CategoryResponse,
    CategoryTreeNode,
    CategoryUpdate,
    MergedAttributeTemplate,
)
from src.categories.service import CategoryService
from src.database import AsyncSessionDep

router = APIRouter()


@router.get("")
async def list_categories(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[CategoryResponse]:
    """List all categories for the current user, ordered by hierarchy path."""
    service = CategoryService(session, user_id)
    categories = await service.get_all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/tree")
async def get_category_tree(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[CategoryTreeNode]:
    """Get categories as a nested tree structure with item counts."""
    service = CategoryService(session, user_id)
    return await service.get_tree()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CategoryResponse:
    """Create a new category."""
    service = CategoryService(session, user_id)

    # Check for duplicate name
    existing = await service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category with name '{data.name}' already exists",
        )

    # Validate parent exists if provided
    if data.parent_id:
        parent = await service.get_by_id(data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found",
            )

    category = await service.create(data)
    return CategoryResponse.model_validate(category)


@router.get("/{category_id}")
async def get_category(
    category_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CategoryResponse:
    """Get a category by ID."""
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return CategoryResponse.model_validate(category)


@router.get("/{category_id}/template")
async def get_category_template(
    category_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> MergedAttributeTemplate:
    """
    Get merged attribute template for a category.

    Returns fields from this category and all ancestors, with child fields
    overriding parent fields of the same name.
    """
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return await service.get_merged_template(category_id)


@router.get("/{category_id}/descendants")
async def get_category_descendants(
    category_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[CategoryResponse]:
    """Get all descendant categories of a category."""
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    descendants = await service.get_descendants(category)
    return [CategoryResponse.model_validate(c) for c in descendants]


@router.put("/{category_id}")
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CategoryResponse:
    """Update a category."""
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Check for duplicate name if updating name
    if data.name and data.name != category.name:
        existing = await service.get_by_name(data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category with name '{data.name}' already exists",
            )

    # Validate parent exists if provided
    if data.parent_id:
        parent = await service.get_by_id(data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found",
            )
        # Prevent setting parent to self or descendant
        descendant_ids = await service.get_descendant_ids(category_id)
        if data.parent_id in descendant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set parent to self or a descendant category",
            )

    category = await service.update(category, data)
    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}/move")
async def move_category(
    category_id: UUID,
    data: CategoryMoveRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CategoryResponse:
    """Move a category to a new parent (or to root level if new_parent_id is null)."""
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Validate new parent exists if provided
    if data.new_parent_id:
        parent = await service.get_by_id(data.new_parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New parent category not found",
            )

    try:
        category = await service.move(category, data.new_parent_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from None

    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Delete a category. Child categories will become root-level categories."""
    service = CategoryService(session, user_id)
    category = await service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    await service.delete(category)
