"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  AlertTriangle,
  Minus,
  LayoutGrid,
  LayoutList,
  CheckSquare,
  Square,
  FolderX,
  MapPinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineFacetedFilter } from "@/components/items/faceted-filter";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { itemsApi, categoriesApi, locationsApi } from "@/lib/api/api-client";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLocalStorage } from "@/hooks/use-local-storage";

type ViewMode = "grid" | "table";

export default function ItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations("items");
  const tCommon = useTranslations("common");

  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "items-view-mode",
    "grid"
  );

  const page = Number(searchParams.get("page")) || 1;
  const categoryId = searchParams.get("category_id") || undefined;
  const locationId = searchParams.get("location_id") || undefined;
  const lowStock = searchParams.get("low_stock") === "true";
  const noCategory = searchParams.get("no_category") === "true";
  const noLocation = searchParams.get("no_location") === "true";

  // Selection state for batch operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState<string>("");
  const [batchLocationId, setBatchLocationId] = useState<string>("");
  const [clearCategory, setClearCategory] = useState(false);
  const [clearLocation, setClearLocation] = useState(false);

  // Parse tags from URL
  const tagsFromUrl = searchParams.getAll("tags");

  // Parse attribute filters from URL
  const attrFiltersFromUrl = useMemo(() => {
    const attrs: Record<string, string> = {};
    searchParams.getAll("attr").forEach((a) => {
      if (a.includes(":")) {
        const [key, value] = a.split(":", 2);
        attrs[key] = value;
      }
    });
    return attrs;
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [showFilters, setShowFilters] = useState(false);

  const { data: itemsData, isLoading } = useQuery({
    queryKey: [
      "items",
      {
        page,
        categoryId,
        locationId,
        noCategory,
        noLocation,
        search: searchQuery,
        lowStock,
        tags: tagsFromUrl,
        attributes: attrFiltersFromUrl,
      },
    ],
    queryFn: () =>
      itemsApi.list({
        page,
        limit: 12,
        category_id: categoryId,
        location_id: locationId,
        no_category: noCategory,
        no_location: noLocation,
        search: searchQuery || undefined,
        tags: tagsFromUrl.length > 0 ? tagsFromUrl : undefined,
        attributes:
          Object.keys(attrFiltersFromUrl).length > 0
            ? attrFiltersFromUrl
            : undefined,
        low_stock: lowStock,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsApi.list(),
  });

  // Fetch facets when a category is selected
  const { data: facetsData } = useQuery({
    queryKey: ["items", "facets", { categoryId, locationId }],
    queryFn: () =>
      itemsApi.facets({ category_id: categoryId, location_id: locationId }),
    enabled: !!categoryId, // Only fetch facets when a category is selected
  });

  // Fetch all tags
  const { data: allTags } = useQuery({
    queryKey: ["items", "tags"],
    queryFn: () => itemsApi.tags(50),
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      itemsApi.updateQuantity(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: itemsApi.batchUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      // Reset selection state
      setSelectedItems(new Set());
      setIsSelectionMode(false);
      setShowBatchPanel(false);
      setBatchCategoryId("");
      setBatchLocationId("");
      setClearCategory(false);
      setClearLocation(false);
    },
  });

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    if (!updates.page) {
      params.delete("page");
    }

    router.push(`/items?${params.toString()}`);
  };

  const updateTags = (tags: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    params.delete("page");
    tags.forEach((tag) => params.append("tags", tag));
    router.push(`/items?${params.toString()}`);
  };

  const updateAttributeFilters = (attrs: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("attr");
    params.delete("page");
    Object.entries(attrs).forEach(([key, value]) => {
      params.append("attr", `${key}:${value}`);
    });
    router.push(`/items?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchQuery || undefined });
  };

  const clearFilters = () => {
    setSearchQuery("");
    router.push("/items");
  };

  const handleQuickDecrement = (
    e: React.MouseEvent,
    itemId: string,
    currentQuantity: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentQuantity > 0) {
      updateQuantityMutation.mutate({
        id: itemId,
        quantity: currentQuantity - 1,
      });
    }
  };

  const handleQuickIncrement = (
    e: React.MouseEvent,
    itemId: string,
    currentQuantity: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantityMutation.mutate({
      id: itemId,
      quantity: currentQuantity + 1,
    });
  };

  // Selection handlers for batch operations
  const toggleItemSelection = (e: React.MouseEvent, itemId: string) => {
    if (!isSelectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (!itemsData?.items) return;
    const allIds = itemsData.items.map((item) => item.id);
    const allSelected = allIds.every((id) => selectedItems.has(id));
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allIds));
    }
  };

  const handleBatchUpdate = () => {
    if (selectedItems.size === 0) return;

    const request: {
      item_ids: string[];
      category_id?: string;
      location_id?: string;
      clear_category?: boolean;
      clear_location?: boolean;
    } = {
      item_ids: Array.from(selectedItems),
    };

    if (clearCategory) {
      request.clear_category = true;
    } else if (batchCategoryId) {
      request.category_id = batchCategoryId;
    }

    if (clearLocation) {
      request.clear_location = true;
    } else if (batchLocationId) {
      request.location_id = batchLocationId;
    }

    batchUpdateMutation.mutate(request);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setShowBatchPanel(false);
  };

  const hasActiveFilters =
    categoryId ||
    locationId ||
    noCategory ||
    noLocation ||
    lowStock ||
    searchQuery ||
    tagsFromUrl.length > 0 ||
    Object.keys(attrFiltersFromUrl).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("itemCount", { count: itemsData?.total ?? 0 })}
          </p>
        </div>
        <div className="flex gap-2">
          {isSelectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={exitSelectionMode}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {tCommon("cancel")}
              </Button>
              <Button
                variant="default"
                onClick={() => setShowBatchPanel(true)}
                disabled={selectedItems.size === 0}
                className="gap-2"
                data-testid="batch-update-button"
              >
                <CheckSquare className="h-4 w-4" />
                {t("selectedCount", { count: selectedItems.size })}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsSelectionMode(true)}
                className="gap-2"
                data-testid="enter-selection-mode"
              >
                <Square className="h-4 w-4" />
                {t("selectItems")}
              </Button>
              <Link href="/items/new" data-testid="add-item-button">
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addItem")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Batch Update Panel */}
      {showBatchPanel && selectedItems.size > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("batchUpdateTitle")}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBatchPanel(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("selectedCount", { count: selectedItems.size })}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("setCategory")}</label>
              <select
                value={batchCategoryId}
                onChange={(e) => {
                  setBatchCategoryId(e.target.value);
                  if (e.target.value) setClearCategory(false);
                }}
                disabled={clearCategory}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                data-testid="batch-category-select"
              >
                <option value="">-- {t("setCategory")} --</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearCategory}
                  onChange={(e) => {
                    setClearCategory(e.target.checked);
                    if (e.target.checked) setBatchCategoryId("");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                {t("clearCategory")}
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("setLocation")}</label>
              <select
                value={batchLocationId}
                onChange={(e) => {
                  setBatchLocationId(e.target.value);
                  if (e.target.value) setClearLocation(false);
                }}
                disabled={clearLocation}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                data-testid="batch-location-select"
              >
                <option value="">-- {t("setLocation")} --</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearLocation}
                  onChange={(e) => {
                    setClearLocation(e.target.checked);
                    if (e.target.checked) setBatchLocationId("");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                {t("clearLocation")}
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBatchPanel(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleBatchUpdate}
              disabled={
                batchUpdateMutation.isPending ||
                (!batchCategoryId &&
                  !batchLocationId &&
                  !clearCategory &&
                  !clearLocation)
              }
              data-testid="apply-batch-changes"
            >
              {batchUpdateMutation.isPending
                ? tCommon("loading")
                : t("applyChanges")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" variant="secondary" className="shrink-0">
              {tCommon("search")}
            </Button>
          </form>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "shrink-0 gap-2",
              hasActiveFilters && "border-primary text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{tCommon("filters")}</span>
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {
                  [
                    categoryId,
                    locationId,
                    noCategory,
                    noLocation,
                    lowStock,
                    searchQuery,
                    tagsFromUrl.length > 0,
                    Object.keys(attrFiltersFromUrl).length > 0,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </Button>

          {/* View Mode Toggle */}
          <div
            className="flex rounded-lg border p-1"
            data-testid="view-mode-toggle"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded px-2 py-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              title={t("viewGrid")}
              data-testid="view-mode-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded px-2 py-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              title={t("viewTable")}
              data-testid="view-mode-table"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={categoryId || ""}
                onChange={(e) =>
                  updateFilters({ category_id: e.target.value || undefined })
                }
                className="h-9 rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">{t("allCategories")}</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={locationId || ""}
                onChange={(e) =>
                  updateFilters({ location_id: e.target.value || undefined })
                }
                className="h-9 rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">{t("allLocations")}</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>

              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted",
                  noCategory && "border-primary bg-primary/5"
                )}
                data-testid="filter-no-category"
              >
                <input
                  type="checkbox"
                  checked={noCategory}
                  onChange={(e) =>
                    updateFilters({
                      no_category: e.target.checked ? "true" : undefined,
                      category_id: e.target.checked ? undefined : categoryId,
                    })
                  }
                  disabled={!!categoryId}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                />
                <FolderX className="h-4 w-4 text-muted-foreground" />
                {t("uncategorizedOnly")}
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted",
                  noLocation && "border-primary bg-primary/5"
                )}
                data-testid="filter-no-location"
              >
                <input
                  type="checkbox"
                  checked={noLocation}
                  onChange={(e) =>
                    updateFilters({
                      no_location: e.target.checked ? "true" : undefined,
                      location_id: e.target.checked ? undefined : locationId,
                    })
                  }
                  disabled={!!locationId}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                />
                <MapPinOff className="h-4 w-4 text-muted-foreground" />
                {t("noLocationOnly")}
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
                <input
                  type="checkbox"
                  checked={lowStock}
                  onChange={(e) =>
                    updateFilters({
                      low_stock: e.target.checked ? "true" : undefined,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t("lowStockOnly")}
              </label>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="ml-auto gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  {tCommon("clearAll")}
                </Button>
              )}
            </div>

            {/* Faceted filters - shown when category is selected */}
            {((facetsData?.facets?.length ?? 0) > 0 ||
              tagsFromUrl.length > 0 ||
              Object.keys(attrFiltersFromUrl).length > 0) && (
              <div className="border-t pt-3">
                <InlineFacetedFilter
                  facets={facetsData?.facets || []}
                  selectedFilters={attrFiltersFromUrl}
                  onFilterChange={updateAttributeFilters}
                  selectedTags={tagsFromUrl}
                  onTagsChange={updateTags}
                />
              </div>
            )}

            {/* Tag filter chips */}
            {allTags && allTags.length > 0 && !categoryId && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("filterByTags")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 10).map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => {
                        if (tagsFromUrl.includes(tag.value)) {
                          updateTags(
                            tagsFromUrl.filter((t) => t !== tag.value)
                          );
                        } else {
                          updateTags([...tagsFromUrl, tag.value]);
                        }
                      }}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        tagsFromUrl.includes(tag.value)
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      #{tag.value}
                      <span className="ml-1 opacity-60">({tag.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{t("loadingItems")}</p>
          </div>
        </div>
      ) : itemsData?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t("noItemsFound")}</h3>
          <p className="mt-1 text-center text-muted-foreground">
            {searchQuery || categoryId || locationId || lowStock
              ? t("tryAdjustingFilters")
              : t("getStartedAddItem")}
          </p>
          <Link href="/items/new" className="mt-6">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addItem")}
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Select All toggle in selection mode */}
          {isSelectionMode && itemsData && itemsData.items.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium"
                data-testid="select-all-toggle"
              >
                {itemsData.items.every((item) => selectedItems.has(item.id)) ? (
                  <>
                    <CheckSquare className="h-4 w-4 text-primary" />
                    {t("deselectAll")}
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" />
                    {t("selectAll")}
                  </>
                )}
              </button>
              <span className="text-sm text-muted-foreground">
                ({t("selectedCount", { count: selectedItems.size })})
              </span>
            </div>
          )}

          {viewMode === "grid" ? (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="items-grid-view"
            >
              {itemsData?.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-card transition-all",
                    isSelectionMode
                      ? selectedItems.has(item.id)
                        ? "border-primary ring-2 ring-primary/20"
                        : "cursor-pointer hover:border-primary/50"
                      : "hover:border-primary/50 hover:shadow-lg"
                  )}
                  onClick={(e) =>
                    isSelectionMode
                      ? toggleItemSelection(e, item.id)
                      : undefined
                  }
                  data-testid={`item-card-${item.id}`}
                >
                  {/* Selection checkbox overlay */}
                  {isSelectionMode && (
                    <div className="absolute left-2 top-2 z-10">
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md border-2 bg-background/80 backdrop-blur-sm",
                          selectedItems.has(item.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/50"
                        )}
                      >
                        {selectedItems.has(item.id) && (
                          <CheckSquare className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Wrap content in Link only when not in selection mode */}
                  {isSelectionMode ? (
                    <div className="relative aspect-square bg-muted">
                      {item.primary_image_url ? (
                        <AuthenticatedImage
                          imageId={item.primary_image_url.split("/").at(-2)!}
                          alt={item.name}
                          thumbnail
                          className="h-full w-full object-cover"
                          fallback={
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-16 w-16 text-muted-foreground/50" />
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                      )}
                      {item.is_low_stock && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                          <AlertTriangle className="h-3 w-3" />
                          {t("lowStock")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link href={`/items/${item.id}`}>
                      <div className="relative aspect-square bg-muted">
                        {item.primary_image_url ? (
                          <AuthenticatedImage
                            imageId={item.primary_image_url.split("/").at(-2)!}
                            alt={item.name}
                            thumbnail
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            fallback={
                              <div className="flex h-full items-center justify-center">
                                <Package className="h-16 w-16 text-muted-foreground/50" />
                              </div>
                            }
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-16 w-16 text-muted-foreground/50" />
                          </div>
                        )}
                        {item.is_low_stock && (
                          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                            <AlertTriangle className="h-3 w-3" />
                            {t("lowStock")}
                          </div>
                        )}
                      </div>
                    </Link>
                  )}

                  {/* Item details section */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
                        {item.name}
                      </h3>
                      {item.price != null && (
                        <span className="shrink-0 text-sm font-medium text-muted-foreground">
                          {formatPrice(item.price, user?.currency)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.category?.icon}{" "}
                      {item.category?.name ?? t("uncategorized")}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      {/* Quick quantity buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleQuickDecrement(e, item.id, item.quantity)
                          }
                          disabled={
                            item.quantity <= 0 ||
                            updateQuantityMutation.isPending
                          }
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                            "hover:bg-muted active:bg-muted/80",
                            "disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                          title={t("decreaseQuantity")}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span
                          className={cn(
                            "min-w-[48px] rounded-lg px-2 py-1 text-center text-sm font-medium",
                            item.is_low_stock
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) =>
                            handleQuickIncrement(e, item.id, item.quantity)
                          }
                          disabled={updateQuantityMutation.isPending}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                            "hover:bg-muted active:bg-muted/80",
                            "disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                          title={t("increaseQuantity")}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.location?.name ?? t("noLocation")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="overflow-x-auto rounded-lg border"
              data-testid="items-table-view"
            >
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {isSelectionMode && (
                      <th className="w-10 whitespace-nowrap px-2 py-3 text-center">
                        <span className="sr-only">Select</span>
                      </th>
                    )}
                    <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
                      {tCommon("name")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium sm:table-cell">
                      {t("category")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium md:table-cell">
                      {t("location")}
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
                      {t("quantity")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-right text-sm font-medium lg:table-cell">
                      {t("price")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsData?.items.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "group transition-colors",
                        isSelectionMode
                          ? selectedItems.has(item.id)
                            ? "bg-primary/5"
                            : "cursor-pointer hover:bg-muted/50"
                          : "hover:bg-muted/50"
                      )}
                      onClick={(e) =>
                        isSelectionMode
                          ? toggleItemSelection(e, item.id)
                          : undefined
                      }
                      data-testid={`item-row-${item.id}`}
                    >
                      {isSelectionMode && (
                        <td className="px-2 py-3 text-center">
                          <div
                            className={cn(
                              "mx-auto flex h-5 w-5 items-center justify-center rounded border-2",
                              selectedItems.has(item.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/50"
                            )}
                          >
                            {selectedItems.has(item.id) && (
                              <CheckSquare className="h-3 w-3" />
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {isSelectionMode ? (
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                              {item.primary_image_url ? (
                                <AuthenticatedImage
                                  imageId={
                                    item.primary_image_url.split("/").at(-2)!
                                  }
                                  alt={item.name}
                                  thumbnail
                                  className="h-full w-full object-cover"
                                  fallback={
                                    <div className="flex h-full items-center justify-center">
                                      <Package className="h-5 w-5 text-muted-foreground/50" />
                                    </div>
                                  }
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-medium">
                                {item.name}
                              </span>
                              {item.is_low_stock && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t("lowStock")}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <Link
                            href={`/items/${item.id}`}
                            className="flex items-center gap-3"
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                              {item.primary_image_url ? (
                                <AuthenticatedImage
                                  imageId={
                                    item.primary_image_url.split("/").at(-2)!
                                  }
                                  alt={item.name}
                                  thumbnail
                                  className="h-full w-full object-cover"
                                  fallback={
                                    <div className="flex h-full items-center justify-center">
                                      <Package className="h-5 w-5 text-muted-foreground/50" />
                                    </div>
                                  }
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-medium transition-colors group-hover:text-primary">
                                {item.name}
                              </span>
                              {item.is_low_stock && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t("lowStock")}
                                </span>
                              )}
                            </div>
                          </Link>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                        {item.category?.icon}{" "}
                        {item.category?.name ?? t("uncategorized")}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        {item.location?.name ?? t("noLocation")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickDecrement(
                                {
                                  preventDefault: () => {},
                                  stopPropagation: () => {},
                                } as React.MouseEvent,
                                item.id,
                                item.quantity
                              )
                            }
                            disabled={
                              item.quantity <= 0 ||
                              updateQuantityMutation.isPending
                            }
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded border transition-colors",
                              "hover:bg-muted active:bg-muted/80",
                              "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            title={t("decreaseQuantity")}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span
                            className={cn(
                              "min-w-[40px] rounded px-2 py-1 text-center text-sm font-medium",
                              item.is_low_stock
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickIncrement(
                                {
                                  preventDefault: () => {},
                                  stopPropagation: () => {},
                                } as React.MouseEvent,
                                item.id,
                                item.quantity
                              )
                            }
                            disabled={updateQuantityMutation.isPending}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded border transition-colors",
                              "hover:bg-muted active:bg-muted/80",
                              "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            title={t("increaseQuantity")}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-sm text-muted-foreground lg:table-cell">
                        {item.price != null
                          ? formatPrice(item.price, user?.currency)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {itemsData && itemsData.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateFilters({ page: String(page - 1) })}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                {tCommon("previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {tCommon("page")}{" "}
                <span className="font-medium text-foreground">{page}</span>{" "}
                {tCommon("of")}{" "}
                <span className="font-medium text-foreground">
                  {itemsData.total_pages}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= itemsData.total_pages}
                onClick={() => updateFilters({ page: String(page + 1) })}
                className="gap-1"
              >
                {tCommon("next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
