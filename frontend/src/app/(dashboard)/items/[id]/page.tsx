"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { itemsApi, imagesApi } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const itemId = params.id as string;

  const {
    confirm,
    setIsLoading: setDeleteLoading,
    ConfirmModal,
  } = useConfirmModal();

  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.get(itemId),
  });

  const updateQuantityMutation = useMutation({
    mutationFn: (quantity: number) => itemsApi.updateQuantity(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
            <img
              src={imagesApi.getFileUrl(
                item.primary_image_url.split("/").pop()!
              )}
              alt={item.name}
              className="aspect-square w-full object-cover"
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
        </div>
      </div>

      <ConfirmModal />
    </div>
  );
}
