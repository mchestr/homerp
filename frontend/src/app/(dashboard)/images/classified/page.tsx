"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Plus,
  Search,
  X,
  LayoutGrid,
  List,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { imagesApi, Image, ClassificationResult } from "@/lib/api/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useViewMode, VIEW_MODES, type ViewMode } from "@/hooks/use-view-mode";

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function ClassifiedImagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("images");
  const tCommon = useTranslations("common");

  const page = Number(searchParams.get("page")) || 1;
  const searchQuery = searchParams.get("search") || "";

  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [viewMode, setViewMode] = useViewMode<ViewMode>(
    "classified-images-view-mode",
    "grid",
    VIEW_MODES
  );

  // Sync searchInput with URL on mount and URL changes
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ["images", "classified", page, searchQuery],
    queryFn: () => imagesApi.listClassified(page, 12, searchQuery || undefined),
  });

  const updateUrl = useCallback(
    (newPage: number, newSearch: string) => {
      const params = new URLSearchParams();
      if (newPage > 1) {
        params.set("page", String(newPage));
      }
      if (newSearch) {
        params.set("search", newSearch);
      }
      const queryString = params.toString();
      router.push(`/images/classified${queryString ? `?${queryString}` : ""}`);
    },
    [router]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      updateUrl(1, searchInput.trim());
    },
    [searchInput, updateUrl]
  );

  const clearSearch = useCallback(() => {
    setSearchInput("");
    updateUrl(1, "");
  }, [updateUrl]);

  const updatePage = useCallback(
    (newPage: number) => {
      updateUrl(newPage, searchQuery);
    },
    [searchQuery, updateUrl]
  );

  const aiResult = selectedImage?.ai_result as ClassificationResult | null;

  const showNoResults = !isLoading && data?.items.length === 0 && searchQuery;
  const showEmpty = !isLoading && data?.items.length === 0 && !searchQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
            {t("classifiedImages")}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm md:mt-1">
            {t("classifiedImagesSubtitle", { count: data?.total ?? 0 })}
          </p>
        </div>
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
              icon: List,
              label: tCommon("viewMode.list"),
            },
          ]}
        />
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-9 pl-9"
            data-testid="classified-images-search-input"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              data-testid="classified-images-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" data-testid="classified-images-search-button">
          {tCommon("search")}
        </Button>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground text-sm">
              {t("loadingImages")}
            </p>
          </div>
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="bg-muted rounded-full p-4">
            <Sparkles className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {t("noClassifiedImages")}
          </h3>
          <p className="text-muted-foreground mt-1 text-center">
            {t("uploadAndClassify")}
          </p>
          <Link href="/items/new" className="mt-6">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {tCommon("add")} {tCommon("item")}
            </Button>
          </Link>
        </div>
      ) : showNoResults ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="bg-muted rounded-full p-4">
            <Search className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t("noSearchResults")}</h3>
          <p className="text-muted-foreground mt-1 text-center">
            {t("noSearchResultsDescription")}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={clearSearch}
            data-testid="classified-images-clear-search-results"
          >
            {t("clearSearch")}
          </Button>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="classified-images-grid-view"
            >
              {data?.items.map((image) => {
                const result = image.ai_result as ClassificationResult | null;
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className="bg-card hover:border-primary/50 group overflow-hidden rounded-xl border text-left transition-all hover:shadow-lg"
                    data-testid={`classified-image-card-${image.id}`}
                  >
                    <div className="bg-muted relative aspect-square">
                      <AuthenticatedImage
                        imageId={image.id}
                        alt={result?.identified_name || t("unknown")}
                        thumbnail
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        fallback={
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="text-muted-foreground/50 h-16 w-16" />
                          </div>
                        }
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white">
                        <Check className="h-3 w-3" />
                        {t("identified")}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="group-hover:text-primary truncate font-semibold transition-colors">
                        {result?.identified_name || t("unknown")}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm">
                        {result?.category_path || t("noCategory")}
                      </p>
                      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                        <span>
                          {result?.confidence
                            ? formatConfidence(result.confidence)
                            : "N/A"}{" "}
                          {t("confidence")}
                        </span>
                        <span>{formatDateTime(image.created_at)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-lg border sm:overflow-x-auto"
              data-testid="classified-images-list-view"
            >
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                      {t("image")}
                    </th>
                    <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap sm:table-cell">
                      {tCommon("category")}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium whitespace-nowrap">
                      {t("confidence")}
                    </th>
                    <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap md:table-cell">
                      {t("classified")}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium whitespace-nowrap">
                      {tCommon("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.items.map((image) => {
                    const result =
                      image.ai_result as ClassificationResult | null;
                    return (
                      <tr
                        key={image.id}
                        className="hover:bg-muted/50 group transition-colors"
                        data-testid={`classified-image-row-${image.id}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedImage(image)}
                            className="flex items-center gap-3 text-left"
                          >
                            <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                              <AuthenticatedImage
                                imageId={image.id}
                                alt={result?.identified_name || t("unknown")}
                                thumbnail
                                className="h-full w-full object-cover"
                                fallback={
                                  <div className="flex h-full items-center justify-center">
                                    <ImageIcon className="text-muted-foreground/50 h-5 w-5" />
                                  </div>
                                }
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="group-hover:text-primary block truncate font-medium transition-colors">
                                {result?.identified_name || t("unknown")}
                              </span>
                              <span className="text-muted-foreground block truncate text-xs sm:hidden">
                                {result?.category_path || t("noCategory")}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td className="text-muted-foreground hidden max-w-[200px] truncate px-4 py-3 text-sm sm:table-cell">
                          {result?.category_path || t("noCategory")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            {result?.confidence
                              ? formatConfidence(result.confidence)
                              : "N/A"}
                          </span>
                        </td>
                        <td className="text-muted-foreground hidden px-4 py-3 text-sm whitespace-nowrap md:table-cell">
                          {formatDateTime(image.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedImage(image)}
                              title={t("viewDetails")}
                              className="h-8 w-8"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!image.item_id && (
                              <Link
                                href={`/items/new?image_id=${image.id}`}
                                title={t("createItemFromThis")}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updatePage(page - 1)}
                className="gap-1"
                data-testid="classified-images-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                {tCommon("previous")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {tCommon("page")}{" "}
                <span className="text-foreground font-medium">{page}</span>{" "}
                {tCommon("of")}{" "}
                <span className="text-foreground font-medium">
                  {data.total_pages}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.total_pages}
                onClick={() => updatePage(page + 1)}
                className="gap-1"
                data-testid="classified-images-next-page"
              >
                {tCommon("next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Image Detail Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {aiResult?.identified_name || t("imageDetails")}
            </DialogTitle>
            <DialogDescription>{t("classificationResult")}</DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <div className="bg-muted aspect-video overflow-hidden rounded-lg">
                <AuthenticatedImage
                  imageId={selectedImage.id}
                  alt={aiResult?.identified_name || t("unknown")}
                  className="h-full w-full object-contain"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="text-muted-foreground/50 h-16 w-16" />
                    </div>
                  }
                />
              </div>

              {aiResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground font-medium">
                        {t("confidence")}
                      </p>
                      <p className="mt-1">
                        {formatConfidence(aiResult.confidence)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">
                        {tCommon("name")}
                      </p>
                      <p className="mt-1">{aiResult.category_path}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-medium">
                      {t("description")}
                    </p>
                    <p className="mt-1 text-sm">{aiResult.description}</p>
                  </div>

                  {aiResult.quantity_estimate && (
                    <div>
                      <p className="text-muted-foreground font-medium">
                        {t("quantityEstimate")}
                      </p>
                      <p className="mt-1 text-sm">
                        {aiResult.quantity_estimate}
                      </p>
                    </div>
                  )}

                  {aiResult.specifications &&
                    Object.keys(aiResult.specifications).length > 0 && (
                      <div>
                        <p className="text-muted-foreground font-medium">
                          {t("specifications")}
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(aiResult.specifications).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="bg-muted rounded px-2 py-1"
                              >
                                <span className="font-medium">{key}:</span>{" "}
                                {String(value)}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {aiResult.alternative_suggestions &&
                    aiResult.alternative_suggestions.length > 0 && (
                      <div>
                        <p className="text-muted-foreground font-medium">
                          {t("alternativeSuggestions")}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {aiResult.alternative_suggestions.map((alt, i) => {
                            const name = alt.name as string;
                            const confidence = alt.confidence as number;
                            return (
                              <span
                                key={i}
                                className="bg-muted rounded-full px-2 py-1 text-xs"
                              >
                                {name} ({formatConfidence(confidence)})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <div className="text-muted-foreground flex justify-between border-t pt-4 text-xs">
                <span>
                  {t("filename")}:{" "}
                  {selectedImage.original_filename || t("unknown")}
                </span>
                <span>
                  {t("classified")}: {formatDateTime(selectedImage.created_at)}
                </span>
              </div>

              {!selectedImage.item_id && (
                <div className="flex justify-end">
                  <Link
                    href={`/items/new?image_id=${selectedImage.id}`}
                    onClick={() => setSelectedImage(null)}
                  >
                    <Button data-testid="create-item-from-image">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("createItemFromThis")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
