"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineFacetedFilter } from "@/components/items/faceted-filter";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { itemsApi, categoriesApi, locationsApi } from "@/lib/api/api-client";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

export default function ItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const page = Number(searchParams.get("page")) || 1;
  const categoryId = searchParams.get("category_id") || undefined;
  const locationId = searchParams.get("location_id") || undefined;
  const lowStock = searchParams.get("low_stock") === "true";

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

  const hasActiveFilters =
    categoryId ||
    locationId ||
    lowStock ||
    searchQuery ||
    tagsFromUrl.length > 0 ||
    Object.keys(attrFiltersFromUrl).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Items
          </h1>
          <p className="mt-1 text-muted-foreground">
            {itemsData?.total ?? 0} items in your inventory
          </p>
        </div>
        <Link href="/items/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" variant="secondary" className="shrink-0">
              Search
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
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {
                  [
                    categoryId,
                    locationId,
                    lowStock,
                    searchQuery,
                    tagsFromUrl.length > 0,
                    Object.keys(attrFiltersFromUrl).length > 0,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </Button>
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
                <option value="">All Categories</option>
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
                <option value="">All Locations</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>

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
                Low stock only
              </label>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="ml-auto gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear all
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
                  Filter by tags
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
            <p className="text-sm text-muted-foreground">Loading items...</p>
          </div>
        </div>
      ) : itemsData?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No items found</h3>
          <p className="mt-1 text-center text-muted-foreground">
            {searchQuery || categoryId || locationId || lowStock
              ? "Try adjusting your filters"
              : "Get started by adding your first item"}
          </p>
          <Link href="/items/new" className="mt-6">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {itemsData?.items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
              >
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
                      Low Stock
                    </div>
                  )}
                </div>
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
                    {item.category?.name ?? "Uncategorized"}
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
                          item.quantity <= 0 || updateQuantityMutation.isPending
                        }
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                          "hover:bg-muted active:bg-muted/80",
                          "disabled:cursor-not-allowed disabled:opacity-50"
                        )}
                        title="Decrease quantity"
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
                        title="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.location?.name ?? "No location"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

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
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span>{" "}
                of{" "}
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
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
