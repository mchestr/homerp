"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FolderOpen, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TreeView, TreeSelect } from "@/components/ui/tree-view";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { AttributeTemplateEditor } from "@/components/items/dynamic-attribute-form";
import { ItemsPanel } from "@/components/items/items-panel";
import {
  categoriesApi,
  Category,
  CategoryCreate,
  CategoryTreeNode,
} from "@/lib/api/client";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [formData, setFormData] = useState<CategoryCreate>({
    name: "",
    icon: "",
    description: "",
    parent_id: undefined,
    attribute_template: { fields: [] },
  });

  const { confirm, ConfirmModal } = useConfirmModal();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: categoryTree, isLoading: isTreeLoading } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoriesApi.tree(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CategoryCreate) => categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryCreate }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "",
      description: "",
      parent_id: undefined,
      attribute_template: { fields: [] },
    });
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      icon: category.icon || "",
      description: category.description || "",
      parent_id: category.parent_id || undefined,
      attribute_template: category.attribute_template || { fields: [] },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Delete Category",
      message: `Are you sure you want to delete "${name}"? Items in this category will become uncategorized, and child categories will become root-level.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    deleteMutation.mutate(id);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    resetForm();
  };

  const handleAddChild = (parentId: string) => {
    setIsCreating(true);
    setFormData((prev) => ({ ...prev, parent_id: parentId }));
  };

  const isFormVisible = isCreating || editingId !== null;

  // Convert tree nodes for TreeSelect (exclude current editing category to prevent circular reference)
  const getSelectableTree = (): CategoryTreeNode[] => {
    if (!categoryTree) return [];
    if (!editingId) return categoryTree;

    // Filter out the editing category and its descendants
    const filterTree = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
      return nodes
        .filter((n) => n.id !== editingId)
        .map((n) => ({
          ...n,
          children: filterTree(n.children),
        }));
    };
    return filterTree(categoryTree);
  };

  // Build a lookup map from tree data for item_count and total_value
  const getTreeStats = (): Map<
    string,
    { item_count: number; total_value: number }
  > => {
    const stats = new Map<
      string,
      { item_count: number; total_value: number }
    >();
    const traverse = (nodes: CategoryTreeNode[]) => {
      for (const node of nodes) {
        stats.set(node.id, {
          item_count: node.item_count,
          total_value: node.total_value,
        });
        if (node.children) traverse(node.children);
      }
    };
    if (categoryTree) traverse(categoryTree);
    return stats;
  };
  const treeStats = getTreeStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Categories
          </h1>
          <p className="mt-1 text-muted-foreground">
            Organize your items into hierarchical categories
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                viewMode === "tree"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              Grid
            </button>
          </div>
          {!isFormVisible && (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          )}
        </div>
      </div>

      {isFormVisible && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border bg-card p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Category" : "New Category"}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Hardware"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Parent Category
              </label>
              <TreeSelect
                nodes={getSelectableTree()}
                value={formData.parent_id ?? null}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    parent_id: value ?? undefined,
                  }))
                }
                placeholder="None (root level)"
                excludeId={editingId ?? undefined}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={formData.icon || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, icon: e.target.value }))
                }
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., a screw emoji"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Description
              </label>
              <input
                type="text"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Attribute Template Editor */}
          <div className="border-t pt-5">
            <AttributeTemplateEditor
              fields={formData.attribute_template?.fields ?? []}
              onChange={(fields) =>
                setFormData((prev) => ({
                  ...prev,
                  attribute_template: { fields },
                }))
              }
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </form>
      )}

      {isLoading || isTreeLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading categories...
            </p>
          </div>
        </div>
      ) : categories?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No categories yet</h3>
          <p className="mt-1 text-center text-muted-foreground">
            Create categories to organize your items
          </p>
          <Button onClick={() => setIsCreating(true)} className="mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      ) : viewMode === "tree" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <TreeView
              nodes={categoryTree ?? []}
              selectedId={selectedId}
              onSelect={(node) => setSelectedId(node.id)}
              renderActions={(node) => (
                <div
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleAddChild(node.id)}
                    className="rounded p-1 hover:bg-accent"
                    title="Add child category"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const category = categories?.find(
                        (c) => c.id === node.id
                      );
                      if (category) handleEdit(category);
                    }}
                    className="rounded p-1 hover:bg-accent"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(node.id, node.name)}
                    className="rounded p-1 hover:bg-accent"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              )}
              emptyMessage="No categories yet"
            />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <ItemsPanel
              categoryId={selectedId}
              title="Items in Category"
              emptyMessage="No items in this category"
              noSelectionMessage="Select a category to view its items"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories?.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() =>
                  setSelectedId(selectedId === category.id ? null : category.id)
                }
                className={`group rounded-xl border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-md ${
                  selectedId === category.id
                    ? "border-primary ring-2 ring-primary/20"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl dark:bg-emerald-400/10">
                      {category.icon || "📁"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{category.name}</h3>
                      {category.parent_id && (
                        <p className="text-xs text-muted-foreground">
                          in{" "}
                          {categories?.find((c) => c.id === category.parent_id)
                            ?.name ?? "..."}
                        </p>
                      )}
                      {category.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      )}
                      {category.attribute_template?.fields?.length > 0 && (
                        <p className="mt-1 text-xs text-primary">
                          {category.attribute_template.fields.length} attribute
                          {category.attribute_template.fields.length !== 1
                            ? "s"
                            : ""}
                        </p>
                      )}
                      {/* Stats from tree data */}
                      {treeStats.get(category.id) && (
                        <div className="mt-2 flex items-center gap-2">
                          {treeStats.get(category.id)!.item_count > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {treeStats.get(category.id)!.item_count} item
                              {treeStats.get(category.id)!.item_count !== 1
                                ? "s"
                                : ""}
                            </span>
                          )}
                          {treeStats.get(category.id)!.total_value > 0 && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              $
                              {treeStats
                                .get(category.id)!
                                .total_value.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAddChild(category.id)}
                      className="h-8 w-8"
                      title="Add child"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(category)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id, category.name)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selectedId && (
            <div className="rounded-xl border bg-card p-4">
              <ItemsPanel
                categoryId={selectedId}
                title={`Items in ${categories?.find((c) => c.id === selectedId)?.name ?? "Category"}`}
                emptyMessage="No items in this category"
                noSelectionMessage="Select a category to view its items"
              />
            </div>
          )}
        </div>
      )}

      <ConfirmModal />
    </div>
  );
}
