"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  Minus,
  Plus,
  MapPin,
  FolderOpen,
  AlertTriangle,
  Calendar,
  Tag,
  DollarSign,
  LogIn,
  LogOut,
  History,
  BarChart3,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { itemsApi, CheckInOutCreate } from "@/lib/api/api-client";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useTranslations } from "next-intl";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const itemId = params.id as string;
  const t = useTranslations("checkInOut");
  const tCommon = useTranslations("common");

  const [checkInOutQuantity, setCheckInOutQuantity] = useState(1);
  const [checkInOutNotes, setCheckInOutNotes] = useState("");

  const {
    confirm,
    setIsLoading: setDeleteLoading,
    ConfirmModal,
  } = useConfirmModal();

  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.get(itemId),
  });

  const { data: usageStats } = useQuery({
    queryKey: ["item", itemId, "usage-stats"],
    queryFn: () => itemsApi.getUsageStats(itemId),
    enabled: !!item,
  });

  const { data: historyData } = useQuery({
    queryKey: ["item", itemId, "history"],
    queryFn: () => itemsApi.getHistory(itemId, 1, 5),
    enabled: !!item,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: (quantity: number) => itemsApi.updateQuantity(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (data: CheckInOutCreate) => itemsApi.checkOut(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({
        queryKey: ["item", itemId, "usage-stats"],
      });
      queryClient.invalidateQueries({ queryKey: ["item", itemId, "history"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setCheckInOutQuantity(1);
      setCheckInOutNotes("");
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (data: CheckInOutCreate) => itemsApi.checkIn(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({
        queryKey: ["item", itemId, "usage-stats"],
      });
      queryClient.invalidateQueries({ queryKey: ["item", itemId, "history"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setCheckInOutQuantity(1);
      setCheckInOutNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => itemsApi.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      router.push("/items");
    },
  });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete Item",
      message: `Are you sure you want to delete "${item?.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    setDeleteLoading(true);
    deleteMutation.mutate();
  };

  const handleQuantityChange = (delta: number) => {
    if (!item) return;
    const newQuantity = Math.max(0, item.quantity + delta);
    updateQuantityMutation.mutate(newQuantity);
  };

  const handleCheckOut = () => {
    checkOutMutation.mutate({
      quantity: checkInOutQuantity,
      notes: checkInOutNotes || undefined,
    });
  };

  const handleCheckIn = () => {
    checkInMutation.mutate({
      quantity: checkInOutQuantity,
      notes: checkInOutNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading item...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Item not found</h2>
        <p className="mt-1 text-muted-foreground">
          This item may have been deleted
        </p>
        <Link href="/items" className="mt-6">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to items
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/items">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
              {item.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Added {new Date(item.created_at).toLocaleDateString()}
              </span>
              {item.is_low_stock && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/items/${itemId}/edit`}>
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-card">
          {item.primary_image_url ? (
            <AuthenticatedImage
              imageId={item.primary_image_url.split("/").at(-2)!}
              alt={item.name}
              className="aspect-square w-full object-cover"
              fallback={
                <div className="flex aspect-square items-center justify-center bg-muted">
                  <Package className="h-24 w-24 text-muted-foreground/50" />
                </div>
              }
            />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted">
              <Package className="h-24 w-24 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Quantity</h2>
              {item.min_quantity != null && (
                <span className="text-sm text-muted-foreground">
                  Min: {String(item.min_quantity)} {item.quantity_unit}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(-1)}
                disabled={
                  item.quantity === 0 || updateQuantityMutation.isPending
                }
                className="h-12 w-12 rounded-full"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    item.is_low_stock && "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {item.quantity}
                </span>
                <p className="text-sm text-muted-foreground">
                  {item.quantity_unit}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(1)}
                disabled={updateQuantityMutation.isPending}
                className="h-12 w-12 rounded-full"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {item.is_low_stock && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Stock is below minimum quantity
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Organization</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <div className="rounded-lg bg-emerald-500/10 p-2 dark:bg-emerald-400/10">
                  <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="truncate font-medium">
                    {item.category?.icon}{" "}
                    {item.category?.name ?? "Uncategorized"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <div className="rounded-lg bg-violet-500/10 p-2 dark:bg-violet-400/10">
                  <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="truncate font-medium">
                    {item.location?.name ?? "No location"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {item.price != null && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2 dark:bg-green-400/10">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatPrice(item.price, user?.currency)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {item.description && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Description</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          )}

          {(() => {
            const attrs = item.attributes;
            if (!attrs || typeof attrs !== "object") return null;
            const specs = (attrs as Record<string, unknown>)["specifications"];
            if (!specs || typeof specs !== "object") return null;
            const entries = Object.entries(specs as Record<string, unknown>);
            if (entries.length === 0) return null;
            return (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">Specifications</h2>
                </div>
                <dl className="mt-4 space-y-3">
                  {entries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <dt className="text-sm capitalize text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm font-medium">
                        {typeof value === "string" || typeof value === "number"
                          ? String(value)
                          : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })()}

          {/* Check-in/out Card */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">{t("checkInOut")}</h2>
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <label className="w-20 text-sm text-muted-foreground">
                  {t("quantity")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={checkInOutQuantity}
                  onChange={(e) =>
                    setCheckInOutQuantity(
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  className="w-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-20 text-sm text-muted-foreground">
                  {t("notes")}
                </label>
                <Input
                  type="text"
                  value={checkInOutNotes}
                  onChange={(e) => setCheckInOutNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCheckOut}
                  disabled={
                    checkOutMutation.isPending || checkInMutation.isPending
                  }
                  className="flex-1 gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {checkOutMutation.isPending
                    ? tCommon("loading")
                    : t("checkOut")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCheckIn}
                  disabled={
                    checkOutMutation.isPending || checkInMutation.isPending
                  }
                  className="flex-1 gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  {checkInMutation.isPending
                    ? tCommon("loading")
                    : t("checkIn")}
                </Button>
              </div>
            </div>
          </div>

          {/* Usage Stats Card */}
          {usageStats && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">{t("usageStats")}</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("totalCheckOuts")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {usageStats.total_check_outs}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("totalCheckIns")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {usageStats.total_check_ins}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("currentlyOut")}
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      usageStats.currently_checked_out > 0 &&
                        "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {usageStats.currently_checked_out}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("lastUsed")}
                  </p>
                  <p className="text-sm font-medium">
                    {usageStats.last_check_out
                      ? new Date(usageStats.last_check_out).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* History Card */}
          {historyData && historyData.items.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">{t("history")}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {historyData.items.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        record.action_type === "check_out"
                          ? "bg-red-500/10 dark:bg-red-400/10"
                          : "bg-green-500/10 dark:bg-green-400/10"
                      )}
                    >
                      {record.action_type === "check_out" ? (
                        <LogOut
                          className={cn(
                            "h-4 w-4",
                            "text-red-600 dark:text-red-400"
                          )}
                        />
                      ) : (
                        <LogIn
                          className={cn(
                            "h-4 w-4",
                            "text-green-600 dark:text-green-400"
                          )}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {record.action_type === "check_out"
                          ? t("checkedOut")
                          : t("checkedIn")}{" "}
                        <span className="text-muted-foreground">
                          x{record.quantity}
                        </span>
                      </p>
                      {record.notes && (
                        <p className="truncate text-xs text-muted-foreground">
                          {record.notes}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(record.occurred_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {historyData.total > 5 && (
                  <p className="text-center text-xs text-muted-foreground">
                    {t("showingRecentHistory", { count: historyData.total })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal />
    </div>
  );
}
