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
import { useViewMode, VIEW_MODES, type ViewMode } from "@/hooks/use-view-mode";

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
    VIEW_MODES
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
          <p className="text-muted-foreground mt-1">
            {t("itemCount", { count: itemsData?.total ?? 0 })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border pr-4 pl-10 text-sm transition-colors focus:ring-2 focus:outline-hidden"
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
            <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground text-sm">
              {tCommon("loading")}
            </p>
          </div>
        </div>
      ) : itemsData?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="bg-muted rounded-full p-4">
            <ArrowRightFromLine className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {t("noItemsCheckedOut")}
          </h3>
          <p className="text-muted-foreground mt-1 text-center">
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
                  className="bg-card hover:border-primary/50 group relative overflow-hidden rounded-xl border transition-all hover:shadow-lg"
                  data-testid={`checked-out-item-card-${item.id}`}
                >
                  <Link href={`/items/${item.id}`}>
                    <div className="bg-muted relative aspect-square">
                      {item.primary_image_url ? (
                        <AuthenticatedImage
                          imageId={item.primary_image_url.split("/").at(-2)!}
                          alt={item.name}
                          thumbnail
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          fallback={
                            <div className="flex h-full items-center justify-center">
                              <Package className="text-muted-foreground/50 h-16 w-16" />
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="text-muted-foreground/50 h-16 w-16" />
                        </div>
                      )}
                      {item.is_low_stock && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white shadow-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {tItems("lowStock")}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/items/${item.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="group-hover:text-primary truncate font-semibold transition-colors">
                          {item.name}
                        </h3>
                        {item.price != null && (
                          <span className="text-muted-foreground shrink-0 text-sm font-medium">
                            {formatPrice(item.price, user?.currency)}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm">
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
                      <span className="text-muted-foreground truncate text-xs">
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
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                      {tCommon("name")}
                    </th>
                    <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap sm:table-cell">
                      {tItems("category")}
                    </th>
                    <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap md:table-cell">
                      {tItems("location")}
                    </th>
                    <th className="hidden px-4 py-3 text-right text-sm font-medium whitespace-nowrap lg:table-cell">
                      {tItems("price")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                      {tCommon("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsData?.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/50 group transition-colors"
                      data-testid={`checked-out-item-row-${item.id}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/items/${item.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
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
                                    <Package className="text-muted-foreground/50 h-5 w-5" />
                                  </div>
                                }
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Package className="text-muted-foreground/50 h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="group-hover:text-primary block truncate font-medium">
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
                      <td className="text-muted-foreground hidden px-4 py-3 text-sm whitespace-nowrap sm:table-cell">
                        {item.category?.icon}{" "}
                        {item.category?.name ?? tItems("uncategorized")}
                      </td>
                      <td className="text-muted-foreground hidden px-4 py-3 text-sm whitespace-nowrap md:table-cell">
                        {item.location?.name ?? tItems("noLocation")}
                      </td>
                      <td className="text-muted-foreground hidden px-4 py-3 text-right text-sm whitespace-nowrap lg:table-cell">
                        {item.price != null
                          ? formatPrice(item.price, user?.currency)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
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
              <span className="text-muted-foreground text-sm">
                {tCommon("page")}{" "}
                <span className="text-foreground font-medium">{page}</span>{" "}
                {tCommon("of")}{" "}
                <span className="text-foreground font-medium">
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
                className="bg-background focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                data-testid="check-in-quantity-input"
              />
              {usageStats && (
                <p className="text-muted-foreground text-xs">
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
                className="bg-background focus:border-primary focus:ring-primary/20 h-20 w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-hidden"
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
