"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  Loader2,
  X,
  LayoutGrid,
  LayoutList,
  TreePine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TreeView, TreeSelect } from "@/components/ui/tree-view";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { AttributeTemplateEditor } from "@/components/items/dynamic-attribute-form";
import { ItemsPanel } from "@/components/items/items-panel";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  categoriesApi,
  Category,
  CategoryCreate,
  CategoryTreeNode,
} from "@/lib/api/api-client";
import {
  useViewMode,
  TREE_VIEW_MODES,
  type TreeViewMode,
} from "@/hooks/use-view-mode";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/auth-context";
import { formatPrice } from "@/lib/utils";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode<TreeViewMode>(
    "categories-view-mode",
    "tree",
    TREE_VIEW_MODES
  );
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
      title: t("deleteCategory"),
      message: t("deleteConfirmMessage", { name }),
      confirmLabel: tCommon("delete"),
      cancelLabel: tCommon("cancel"),
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
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "tree",
                icon: TreePine,
                label: tCommon("viewMode.tree"),
              },
              {
                value: "grid",
                icon: LayoutGrid,
                label: tCommon("viewMode.grid"),
              },
              {
                value: "list",
                icon: LayoutList,
                label: tCommon("viewMode.list"),
              },
            ]}
          />
          {!isFormVisible && (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("addCategory")}
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
              {editingId ? t("editCategory") : t("newCategory")}
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
              <label className="mb-2 block text-sm font-medium">
                {tCommon("name")} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                data-testid="category-name-input"
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("parentCategory")}
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
                placeholder={t("noneRootLevel")}
                excludeId={editingId ?? undefined}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("iconEmoji")}
              </label>
              <input
                type="text"
                value={formData.icon || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, icon: e.target.value }))
                }
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("iconPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                {tCommon("description")}
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
                placeholder={t("descriptionPlaceholder")}
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
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="category-submit-button"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? t("updateCategory") : t("createCategory")}
            </Button>
          </div>
        </form>
      )}

      {isLoading || isTreeLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {t("loadingCategories")}
            </p>
          </div>
        </div>
      ) : categories?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t("noCategoriesYet")}</h3>
          <p className="mt-1 text-center text-muted-foreground">
            {t("createToOrganize")}
          </p>
          <Button onClick={() => setIsCreating(true)} className="mt-6">
            <Plus className="mr-2 h-4 w-4" />
            {t("addCategory")}
          </Button>
        </div>
      ) : viewMode === "tree" ? (
        <div
          className="grid gap-6 lg:grid-cols-2"
          data-testid="categories-tree-view"
        >
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
                    title={t("addChildCategory")}
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
                    title={tCommon("edit")}
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(node.id, node.name)}
                    className="rounded p-1 hover:bg-accent"
                    title={tCommon("delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              )}
              emptyMessage={t("noCategoriesYet")}
            />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <ItemsPanel
              categoryId={selectedId}
              title={t("itemsInCategory")}
              emptyMessage={t("noItemsInCategory")}
              noSelectionMessage={t("selectCategoryToView")}
            />
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-6" data-testid="categories-grid-view">
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
                data-testid={`category-card-${category.id}`}
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
                          {t("in")}{" "}
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
                          {category.attribute_template.fields.length === 1
                            ? t("attributeCount", { count: 1 })
                            : t("attributeCountPlural", {
                                count:
                                  category.attribute_template.fields.length,
                              })}
                        </p>
                      )}
                      {/* Stats from tree data */}
                      {treeStats.get(category.id) && (
                        <div className="mt-2 flex items-center gap-2">
                          {treeStats.get(category.id)!.item_count > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {treeStats.get(category.id)!.item_count === 1
                                ? tCommon("itemCount", { count: 1 })
                                : tCommon("itemCountPlural", {
                                    count: treeStats.get(category.id)!
                                      .item_count,
                                  })}
                            </span>
                          )}
                          {treeStats.get(category.id)!.total_value > 0 && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              {tCommon("totalValue", {
                                value:
                                  formatPrice(
                                    treeStats.get(category.id)!.total_value,
                                    user?.currency || "USD"
                                  ) ?? "",
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
                      title={t("addChildCategory")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(category)}
                      className="h-8 w-8"
                      title={tCommon("edit")}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id, category.name)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title={tCommon("delete")}
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
                title={`${t("itemsInCategory").replace("Category", "")} ${categories?.find((c) => c.id === selectedId)?.name ?? ""}`}
                emptyMessage={t("noItemsInCategory")}
                noSelectionMessage={t("selectCategoryToView")}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6" data-testid="categories-list-view">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
                    {tCommon("name")}
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium sm:table-cell">
                    {t("parentCategory")}
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium md:table-cell">
                    {tCommon("description")}
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-center text-sm font-medium lg:table-cell">
                    {tCommon("items")}
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                    {tCommon("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categories?.map((category) => (
                  <tr
                    key={category.id}
                    className="group transition-colors hover:bg-muted/50"
                    data-testid={`category-row-${category.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon || "📁"}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                      {category.parent_id
                        ? (categories?.find((c) => c.id === category.parent_id)
                            ?.name ?? "-")
                        : "-"}
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      {category.description || "-"}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-center text-sm text-muted-foreground lg:table-cell">
                      {treeStats.get(category.id)?.item_count ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddChild(category.id)}
                          title={t("addChildCategory")}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(category)}
                          title={tCommon("edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDelete(category.id, category.name)
                          }
                          className="text-destructive hover:text-destructive"
                          title={tCommon("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedId && (
            <div className="rounded-xl border bg-card p-4">
              <ItemsPanel
                categoryId={selectedId}
                title={`${t("itemsInCategory").replace("Category", "")} ${categories?.find((c) => c.id === selectedId)?.name ?? ""}`}
                emptyMessage={t("noItemsInCategory")}
                noSelectionMessage={t("selectCategoryToView")}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmModal />
    </div>
  );
}
