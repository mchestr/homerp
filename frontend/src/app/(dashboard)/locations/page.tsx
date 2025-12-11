"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TreeView, TreeSelect } from "@/components/ui/tree-view";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { ItemsPanel } from "@/components/items/items-panel";
import {
  locationsApi,
  Location,
  LocationCreate,
  LocationTreeNode,
} from "@/lib/api/api-client";

const LOCATION_TYPES = [
  { value: "room", label: "Room", icon: "🏠" },
  { value: "shelf", label: "Shelf", icon: "📚" },
  { value: "bin", label: "Bin", icon: "🗑️" },
  { value: "drawer", label: "Drawer", icon: "🗄️" },
  { value: "box", label: "Box", icon: "📦" },
  { value: "cabinet", label: "Cabinet", icon: "🚪" },
];

// Convert LocationTreeNode to have icon property for TreeView
function addIconsToTree(
  nodes: LocationTreeNode[]
): (LocationTreeNode & { icon: string })[] {
  return nodes.map((node) => ({
    ...node,
    icon:
      LOCATION_TYPES.find((t) => t.value === node.location_type)?.icon || "📍",
    children: addIconsToTree(node.children),
  }));
}

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [formData, setFormData] = useState<LocationCreate>({
    name: "",
    description: "",
    location_type: "",
    parent_id: undefined,
  });

  const { confirm, ConfirmModal } = useConfirmModal();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsApi.list(),
  });

  const { data: locationTree, isLoading: isTreeLoading } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  const createMutation = useMutation({
    mutationFn: (data: LocationCreate) => locationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LocationCreate }) =>
      locationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setSelectedId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      location_type: "",
      parent_id: undefined,
    });
  };

  const handleEdit = (location: Location) => {
    setEditingId(location.id);
    setFormData({
      name: location.name,
      description: location.description || "",
      location_type: location.location_type || "",
      parent_id: location.parent_id || undefined,
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
      title: "Delete Location",
      message: `Are you sure you want to delete "${name}"? Items in this location will have no location, and child locations will become root-level.`,
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

  const getLocationTypeInfo = (type: string | null | undefined) => {
    return LOCATION_TYPES.find((t) => t.value === type);
  };

  // Convert tree nodes for TreeSelect (exclude current editing location to prevent circular reference)
  const getSelectableTree = (): LocationTreeNode[] => {
    if (!locationTree) return [];
    if (!editingId) return locationTree;

    const filterTree = (nodes: LocationTreeNode[]): LocationTreeNode[] => {
      return nodes
        .filter((n) => n.id !== editingId)
        .map((n) => ({
          ...n,
          children: filterTree(n.children),
        }));
    };
    return filterTree(locationTree);
  };

  // Add icons to tree for display
  const treeWithIcons = locationTree ? addIconsToTree(locationTree) : [];
  const selectTreeWithIcons = addIconsToTree(getSelectableTree());

  // Build a lookup map from tree data for item_count and total_value
  const getTreeStats = (): Map<
    string,
    { item_count: number; total_value: number }
  > => {
    const stats = new Map<
      string,
      { item_count: number; total_value: number }
    >();
    const traverse = (nodes: LocationTreeNode[]) => {
      for (const node of nodes) {
        stats.set(node.id, {
          item_count: node.item_count,
          total_value: node.total_value,
        });
        if (node.children) traverse(node.children);
      }
    };
    if (locationTree) traverse(locationTree);
    return stats;
  };
  const treeStats = getTreeStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Locations
          </h1>
          <p className="mt-1 text-muted-foreground">
            Track where your items are stored in hierarchical locations
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
              data-testid="add-location-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Location
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
              {editingId ? "Edit Location" : "New Location"}
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
                data-testid="location-name-input"
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Workshop Shelf A"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Parent Location
              </label>
              <TreeSelect
                nodes={selectTreeWithIcons}
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
              <label className="mb-2 block text-sm font-medium">Type</label>
              <select
                value={formData.location_type || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    location_type: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select type</option>
                {LOCATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
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
              data-testid="location-submit-button"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Update Location" : "Create Location"}
            </Button>
          </div>
        </form>
      )}

      {isLoading || isTreeLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading locations...
            </p>
          </div>
        </div>
      ) : locations?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <MapPin className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No locations yet</h3>
          <p className="mt-1 text-center text-muted-foreground">
            Create locations to track where items are stored
          </p>
          <Button onClick={() => setIsCreating(true)} className="mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>
      ) : viewMode === "tree" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <TreeView
              nodes={treeWithIcons}
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
                    title="Add child location"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const location = locations?.find((l) => l.id === node.id);
                      if (location) handleEdit(location);
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
              emptyMessage="No locations yet"
            />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <ItemsPanel
              locationId={selectedId}
              title="Items in Location"
              emptyMessage="No items in this location"
              noSelectionMessage="Select a location to view its items"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations?.map((location) => {
              const typeInfo = getLocationTypeInfo(location.location_type);
              return (
                <button
                  type="button"
                  key={location.id}
                  onClick={() =>
                    setSelectedId(
                      selectedId === location.id ? null : location.id
                    )
                  }
                  className={`group rounded-xl border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-md ${
                    selectedId === location.id
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-2xl dark:bg-violet-400/10">
                        {typeInfo?.icon || "📍"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{location.name}</h3>
                        {location.parent_id && (
                          <p className="text-xs text-muted-foreground">
                            in{" "}
                            {locations?.find((l) => l.id === location.parent_id)
                              ?.name ?? "..."}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {location.location_type && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                              {location.location_type}
                            </span>
                          )}
                          {location.description && (
                            <span className="line-clamp-1">
                              {location.description}
                            </span>
                          )}
                        </div>
                        {/* Stats from tree data */}
                        {treeStats.get(location.id) && (
                          <div className="mt-2 flex items-center gap-2">
                            {treeStats.get(location.id)!.item_count > 0 && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {treeStats.get(location.id)!.item_count} item
                                {treeStats.get(location.id)!.item_count !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
                            {treeStats.get(location.id)!.total_value > 0 && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                $
                                {treeStats
                                  .get(location.id)!
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
                        onClick={() => handleAddChild(location.id)}
                        className="h-8 w-8"
                        title="Add child"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(location)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(location.id, location.name)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedId && (
            <div className="rounded-xl border bg-card p-4">
              <ItemsPanel
                locationId={selectedId}
                title={`Items in ${locations?.find((l) => l.id === selectedId)?.name ?? "Location"}`}
                emptyMessage="No items in this location"
                noSelectionMessage="Select a location to view its items"
              />
            </div>
          )}
        </div>
      )}

      <ConfirmModal />
    </div>
  );
}
