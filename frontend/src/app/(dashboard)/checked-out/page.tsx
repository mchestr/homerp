"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  AlertTriangle,
  ArrowRightFromLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { SpecificationTags } from "@/components/items/specification-tags";
import { itemsApi } from "@/lib/api/api-client";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

export default function CheckedOutItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations("checkedOut");
  const tCommon = useTranslations("common");
  const tItems = useTranslations("items");

  const page = Number(searchParams.get("page")) || 1;
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["items", "checked-out", { page, search: searchQuery }],
    queryFn: () =>
      itemsApi.list({
        page,
        limit: 12,
        checked_out: true,
        search: searchQuery || undefined,
      }),
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

    router.push(`/checked-out?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchQuery || undefined });
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
      </div>

      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="checked-out-search-input"
            />
          </div>
          <Button type="submit" variant="secondary" className="shrink-0">
            {tCommon("search")}
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {tCommon("loading")}
            </p>
          </div>
        </div>
      ) : itemsData?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <ArrowRightFromLine className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {t("noItemsCheckedOut")}
          </h3>
          <p className="mt-1 text-center text-muted-foreground">
            {t("noItemsDescription")}
          </p>
          <Link href="/items" className="mt-6">
            <Button variant="outline">{tItems("title")}</Button>
          </Link>
        </div>
      ) : (
        <>
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="checked-out-items-grid"
          >
            {itemsData?.items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
                data-testid={`checked-out-item-card-${item.id}`}
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
                      {tItems("lowStock")}
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
                    {item.category?.name ?? tItems("uncategorized")}
                  </p>
                  <SpecificationTags
                    attributes={item.attributes}
                    maxCount={3}
                    className="mt-2"
                  />
                  <div className="mt-3 flex items-center justify-between">
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
                        title={tItems("decreaseQuantity")}
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
                        title={tItems("increaseQuantity")}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.location?.name ?? tItems("noLocation")}
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
