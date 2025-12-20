"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Minus,
  Plus,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { itemsApi } from "@/lib/api/api";
import { cn, formatPrice, getItemSubtitle } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

interface ItemsPanelProps {
  categoryId?: string | null;
  locationId?: string | null;
  title?: string;
  emptyMessage?: string;
  noSelectionMessage?: string;
}

export function ItemsPanel({
  categoryId,
  locationId,
  title = "Items",
  emptyMessage = "No items found",
  noSelectionMessage = "Select an item from the tree to view its contents",
}: ItemsPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tCommon = useTranslations("common");
  const [page, setPage] = useState(1);

  const hasSelection = !!categoryId || !!locationId;

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["items", "panel", { page, categoryId, locationId }],
    queryFn: () =>
      itemsApi.list({
        page,
        limit: 8,
        category_id: categoryId || undefined,
        location_id: locationId || undefined,
        include_subcategories: true,
        include_sublocations: true,
      }),
    enabled: hasSelection,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      itemsApi.updateQuantity(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

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

  // Reset page when selection changes
  if (page !== 1 && !hasSelection) {
    setPage(1);
  }

  if (!hasSelection) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center">
        <div className="bg-muted rounded-full p-4">
          <MousePointerClick className="text-muted-foreground h-8 w-8" />
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          {noSelectionMessage}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading items...</p>
        </div>
      </div>
    );
  }

  if (!itemsData?.items.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center">
        <div className="bg-muted rounded-full p-4">
          <Package className="text-muted-foreground h-8 w-8" />
        </div>
        <p className="text-muted-foreground mt-4 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-muted-foreground text-sm">
          {itemsData.total} item{itemsData.total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {itemsData.items.map((item) => (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            className="bg-card hover:border-primary/50 group flex gap-3 overflow-hidden rounded-lg border p-3 transition-all hover:shadow-md"
          >
            <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
              {item.primary_image_url ? (
                <AuthenticatedImage
                  imageId={item.primary_image_url.split("/").at(-2)!}
                  alt={item.name}
                  thumbnail
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <Package className="text-muted-foreground/50 h-6 w-6" />
                    </div>
                  }
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="text-muted-foreground/50 h-6 w-6" />
                </div>
              )}
              {item.is_low_stock && (
                <div className="absolute -top-1 -right-1 rounded-full bg-amber-500 p-1">
                  <AlertTriangle className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-1">
                  <h4 className="group-hover:text-primary truncate text-sm font-medium">
                    {item.name}
                  </h4>
                  {item.price != null && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatPrice(item.price, user?.currency)}
                    </span>
                  )}
                </div>
                {(() => {
                  const subtitle = getItemSubtitle({
                    attributes: item.attributes,
                    category: item.category,
                    maxAttributes: 2,
                  });
                  return subtitle ? (
                    <p
                      className="text-muted-foreground truncate text-xs"
                      data-testid="item-subtitle"
                    >
                      {subtitle}
                    </p>
                  ) : null;
                })()}
                <p className="text-muted-foreground truncate text-xs">
                  {item.category?.icon}{" "}
                  {item.category?.name ?? tCommon("uncategorized")}
                </p>
              </div>

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
                    "flex h-6 w-6 items-center justify-center rounded border transition-colors",
                    "hover:bg-muted active:bg-muted/80",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span
                  className={cn(
                    "min-w-[32px] rounded px-1.5 py-0.5 text-center text-xs font-medium",
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
                    "flex h-6 w-6 items-center justify-center rounded border transition-colors",
                    "hover:bg-muted active:bg-muted/80",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {itemsData.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="h-8 gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-xs">
            {page} / {itemsData.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= itemsData.total_pages}
            onClick={() => setPage(page + 1)}
            className="h-8 gap-1"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
