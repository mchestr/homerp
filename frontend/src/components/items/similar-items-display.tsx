"use client";

import Link from "next/link";
import { Package, AlertTriangle, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { SimilarItemMatch } from "@/lib/api/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type SimilarItemsDisplayProps = {
  items: SimilarItemMatch[];
  totalSearched: number;
  onUpdateQuantity?: (itemId: string, currentQuantity: number) => void;
  isUpdatingQuantity?: boolean;
};

export function SimilarItemsDisplay({
  items,
  totalSearched,
  onUpdateQuantity,
  isUpdatingQuantity,
}: SimilarItemsDisplayProps) {
  const t = useTranslations("similarItems");
  const tCommon = useTranslations("common");

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30"
      data-testid="similar-items-section"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500">
          <AlertTriangle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
            {t("title")}
          </h2>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t("description", { count: totalSearched })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-lg bg-white/60 p-4 dark:bg-black/20"
            data-testid={`similar-item-${item.id}`}
          >
            {/* Image placeholder or actual image */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
              {item.primary_image_url ? (
                <AuthenticatedImage
                  imageId={item.primary_image_url.split("/").at(-2)!}
                  alt={item.name}
                  thumbnail
                  className="h-full w-full rounded-lg object-cover"
                  fallback={<Package className="h-8 w-8 text-amber-400" />}
                />
              ) : (
                <Package className="h-8 w-8 text-amber-400" />
              )}
            </div>

            {/* Item details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/items/${item.id}`}
                  className="truncate font-medium text-amber-900 hover:underline dark:text-amber-200"
                >
                  {item.name}
                </Link>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <span>
                  {tCommon("quantity")}: {item.quantity} {item.quantity_unit}
                </span>
                {item.category && (
                  <>
                    <span className="text-amber-400">|</span>
                    <span>{item.category.name}</span>
                  </>
                )}
                {item.location && (
                  <>
                    <span className="text-amber-400">|</span>
                    <span>{item.location.name}</span>
                  </>
                )}
              </div>

              {/* Match reasons */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.match_reasons.map((reason, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            {/* Similarity score and actions */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div
                className={cn(
                  "rounded-full px-2 py-0.5 text-sm font-medium",
                  item.similarity_score >= 0.7
                    ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                    : item.similarity_score >= 0.4
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                )}
              >
                {Math.round(item.similarity_score * 100)}% {t("match")}
              </div>

              {onUpdateQuantity && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                  onClick={() => onUpdateQuantity(item.id, item.quantity)}
                  disabled={isUpdatingQuantity}
                  data-testid={`update-quantity-${item.id}`}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("addToQuantity")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
        {t("continueToCreate")}
      </p>
    </div>
  );
}
