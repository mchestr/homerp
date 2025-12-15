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
  AlertTriangle,
  ArrowRightFromLine,
  ArrowLeftFromLine,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { SpecificationTags } from "@/components/items/specification-tags";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { itemsApi, ItemListItem, CheckInOutCreate } from "@/lib/api/api-client";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useViewMode, type ViewMode } from "@/hooks/use-view-mode";

export default function CheckedOutItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations("checkedOut");
  const tCommon = useTranslations("common");
  const tItems = useTranslations("items");
  const tCheckInOut = useTranslations("checkInOut");

  const [viewMode, setViewMode] = useViewMode<ViewMode>(
    "checked-out-view-mode",
    "grid",
    ["grid", "list"]
  );

  const page = Number(searchParams.get("page")) || 1;
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );

  // Check-in dialog state
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemListItem | null>(null);
  const [checkInQuantity, setCheckInQuantity] = useState(1);
  const [checkInNotes, setCheckInNotes] = useState("");

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

  // Fetch usage stats for selected item to know how many are checked out
  const { data: usageStats } = useQuery({
    queryKey: ["items", selectedItem?.id, "usage-stats"],
    queryFn: () => itemsApi.getUsageStats(selectedItem!.id),
    enabled: !!selectedItem,
  });

  const checkInMutation = useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: CheckInOutCreate;
    }) => itemsApi.checkIn(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setCheckInDialogOpen(false);
      setSelectedItem(null);
      setCheckInQuantity(1);
      setCheckInNotes("");
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

  const handleOpenCheckInDialog = (e: React.MouseEvent, item: ItemListItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(item);
    setCheckInQuantity(1);
    setCheckInNotes("");
    setCheckInDialogOpen(true);
  };

  const handleCheckIn = () => {
    if (!selectedItem) return;
    checkInMutation.mutate({
      itemId: selectedItem.id,
      data: {
        quantity: checkInQuantity,
        notes: checkInNotes || undefined,
      },
    });
  };

  const maxCheckInQuantity = usageStats?.currently_checked_out ?? 1;

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

      <div className="flex items-center gap-4">
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
        <ViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          options={[
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
          {viewMode === "grid" ? (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="checked-out-items-grid"
            >
              {itemsData?.items.map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
                  data-testid={`checked-out-item-card-${item.id}`}
                >
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
                          {tItems("lowStock")}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/items/${item.id}`}>
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
                    </Link>
                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleOpenCheckInDialog(e, item)}
                        className="gap-1.5"
                        data-testid={`check-in-button-${item.id}`}
                      >
                        <ArrowLeftFromLine className="h-4 w-4" />
                        {tCheckInOut("checkIn")}
                      </Button>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.location?.name ?? tItems("noLocation")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="overflow-x-auto rounded-lg border"
              data-testid="checked-out-items-list"
            >
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
                      {tCommon("name")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium sm:table-cell">
                      {tItems("category")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-left text-sm font-medium md:table-cell">
                      {tItems("location")}
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 text-right text-sm font-medium lg:table-cell">
                      {tItems("price")}
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                      {tCommon("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsData?.items.map((item) => (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-muted/50"
                      data-testid={`checked-out-item-row-${item.id}`}
                    >
                      <td className="px-4 py-3">
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
                            <span className="block truncate font-medium group-hover:text-primary">
                              {item.name}
                            </span>
                            {item.is_low_stock && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                {tItems("lowStock")}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                        {item.category?.icon}{" "}
                        {item.category?.name ?? tItems("uncategorized")}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        {item.location?.name ?? tItems("noLocation")}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-sm text-muted-foreground lg:table-cell">
                        {item.price != null
                          ? formatPrice(item.price, user?.currency)
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleOpenCheckInDialog(e, item)}
                          className="gap-1.5"
                          data-testid={`check-in-button-${item.id}`}
                        >
                          <ArrowLeftFromLine className="h-4 w-4" />
                          {tCheckInOut("checkIn")}
                        </Button>
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

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCheckInOut("checkIn")}</DialogTitle>
            <DialogDescription>{selectedItem?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tCheckInOut("quantity")}
              </label>
              <input
                type="number"
                min={1}
                max={maxCheckInQuantity}
                value={checkInQuantity}
                onChange={(e) =>
                  setCheckInQuantity(
                    Math.max(
                      1,
                      Math.min(
                        maxCheckInQuantity,
                        parseInt(e.target.value) || 1
                      )
                    )
                  )
                }
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="check-in-quantity-input"
              />
              {usageStats && (
                <p className="text-xs text-muted-foreground">
                  {tCheckInOut("currentlyOut")}:{" "}
                  {usageStats.currently_checked_out}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tCheckInOut("notes")}
              </label>
              <textarea
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
                placeholder={tCheckInOut("notesPlaceholder")}
                className="h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="check-in-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCheckInDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={
                checkInMutation.isPending ||
                checkInQuantity > maxCheckInQuantity
              }
              data-testid="confirm-check-in-button"
            >
              {checkInMutation.isPending
                ? tCommon("loading")
                : tCheckInOut("checkIn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
