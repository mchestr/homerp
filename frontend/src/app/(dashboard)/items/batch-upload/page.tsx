"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  ImagePlus,
  Package,
  CheckCircle2,
  X,
  Plus,
  AlertCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TreeSelect } from "@/components/ui/tree-view";
import {
  itemsApi,
  imagesApi,
  categoriesApi,
  locationsApi,
  ClassificationResult,
  BatchItemCreate,
  LocationTreeNode,
} from "@/lib/api/api-client";
import {
  cn,
  parseQuantityEstimate,
  isInsufficientCreditsError,
} from "@/lib/utils";
import { useInsufficientCreditsModal } from "@/components/billing/insufficient-credits-modal";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useOperationCosts } from "@/hooks/use-operation-costs";

// Add icons to location tree for display
const LOCATION_TYPES: Record<string, string> = {
  room: "house",
  shelf: "book-open",
  bin: "trash-2",
  drawer: "archive",
  box: "box",
  cabinet: "door-closed",
};

function addIconsToLocationTree(
  nodes: LocationTreeNode[]
): (LocationTreeNode & { icon: string })[] {
  return nodes.map((node) => ({
    ...node,
    icon: LOCATION_TYPES[node.location_type || ""] || "map-pin",
    children: addIconsToLocationTree(node.children),
  }));
}

// A batch item that has been uploaded and classified
type BatchItem = {
  id: string;
  imageId: string;
  imageUrl: string;
  filename: string;
  classification: ClassificationResult | null;
  isClassifying: boolean;
  isSelected: boolean;
  formData: BatchItemCreate;
};

export default function BatchUploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations();
  const tBatch = useTranslations("batch");
  const tImages = useTranslations("images");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("billing");

  const [items, setItems] = useState<BatchItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show: showInsufficientCredits, InsufficientCreditsModal } =
    useInsufficientCreditsModal();
  const { refreshCredits } = useAuth();
  const { getCost } = useOperationCosts();
  const imageClassificationCost = getCost("image_classification");

  const { data: categoryTree } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoriesApi.tree(),
  });

  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  const locationTreeWithIcons = locationTree
    ? addIconsToLocationTree(locationTree)
    : [];

  const createBatchMutation = useMutation({
    mutationFn: async (selectedItems: BatchItem[]) => {
      const itemsToCreate = selectedItems.map((item) => item.formData);
      const result = await itemsApi.batchCreate({ items: itemsToCreate });

      // Attach images to created items using index-based matching
      // Results are returned in the same order as the input items
      for (let i = 0; i < result.results.length; i++) {
        const itemResult = result.results[i];
        const batchItem = selectedItems[i];
        if (itemResult.success && itemResult.item_id && batchItem) {
          await imagesApi.attachToItem(
            batchItem.imageId,
            itemResult.item_id,
            true
          );
        }
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: tBatch("itemsCreated"),
        description: tBatch("itemsCreatedDescription", {
          count: result.created_count,
        }),
      });
      router.push("/items");
    },
    onError: () => {
      toast({
        title: tCommon("error"),
        description: tBatch("createFailed"),
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setError(null);
      setIsUploading(true);

      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) {
          setError(tImages("pleaseSelectImageFile"));
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          setError(tImages("imageMustBeLessThan10MB"));
          continue;
        }

        try {
          const result = await imagesApi.upload(file);
          const { url } = await imagesApi.getSignedUrl(result.id);
          const imageData = await imagesApi.get(result.id);

          const newItem: BatchItem = {
            id: `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            imageId: result.id,
            imageUrl: url,
            filename: result.original_filename || file.name,
            classification: imageData.ai_processed
              ? (imageData.ai_result as ClassificationResult)
              : null,
            isClassifying: false,
            isSelected: true,
            formData: {
              name: imageData.ai_processed
                ? (imageData.ai_result as ClassificationResult).identified_name
                : file.name.replace(/\.[^/.]+$/, ""),
              description: imageData.ai_processed
                ? (imageData.ai_result as ClassificationResult).description
                : undefined,
              quantity: 1,
              quantity_unit: "pcs",
              attributes: {},
              tags: [],
              image_ids: [result.id],
            },
          };

          // If AI processed, populate form data from classification
          if (imageData.ai_processed && imageData.ai_result) {
            const classification = imageData.ai_result as ClassificationResult;
            const parsed = parseQuantityEstimate(
              classification.quantity_estimate
            );
            newItem.formData = {
              ...newItem.formData,
              name: classification.identified_name,
              description: classification.description,
              quantity: parsed.quantity,
              quantity_unit: parsed.quantity_unit,
              attributes: {
                specifications: classification.specifications,
                ai_confidence: classification.confidence,
                ai_category_suggestion: classification.category_path,
              },
            };
          }

          setItems((prev) => [...prev, newItem]);
        } catch (err) {
          console.error("Upload error:", err);
          setError(tImages("uploadFailed"));
        }
      }

      setIsUploading(false);
    },
    [tImages]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files);
      }
      e.target.value = "";
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  const handleClassifyItem = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isClassifying: true } : i))
    );

    try {
      const response = await imagesApi.classify([item.imageId]);
      if (response.success && response.classification) {
        const classification = response.classification;
        const parsed = parseQuantityEstimate(classification.quantity_estimate);

        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  classification,
                  isClassifying: false,
                  formData: {
                    ...i.formData,
                    name: classification.identified_name,
                    description: classification.description,
                    quantity: parsed.quantity,
                    quantity_unit: parsed.quantity_unit,
                    attributes: {
                      specifications: classification.specifications,
                      ai_confidence: classification.confidence,
                      ai_category_suggestion: classification.category_path,
                    },
                  },
                }
              : i
          )
        );
        refreshCredits();
      }
    } catch (err: unknown) {
      console.error("Classification error:", err);
      if (isInsufficientCreditsError(err)) {
        showInsufficientCredits();
      }
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isClassifying: false } : i))
      );
    }
  };

  const handleClassifyAll = async () => {
    const unclassifiedItems = items.filter((item) => !item.classification);
    if (unclassifiedItems.length === 0) return;

    // Mark all as classifying
    setItems((prev) =>
      prev.map((i) => (!i.classification ? { ...i, isClassifying: true } : i))
    );

    // Classify each one individually (API supports batch but returns single result)
    for (const item of unclassifiedItems) {
      try {
        const response = await imagesApi.classify([item.imageId]);
        if (response.success && response.classification) {
          const classification = response.classification;
          const parsed = parseQuantityEstimate(
            classification.quantity_estimate
          );

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    classification,
                    isClassifying: false,
                    formData: {
                      ...i.formData,
                      name: classification.identified_name,
                      description: classification.description,
                      quantity: parsed.quantity,
                      quantity_unit: parsed.quantity_unit,
                      attributes: {
                        specifications: classification.specifications,
                        ai_confidence: classification.confidence,
                        ai_category_suggestion: classification.category_path,
                      },
                    },
                  }
                : i
            )
          );
        }
      } catch (err: unknown) {
        console.error("Classification error:", err);
        if (isInsufficientCreditsError(err)) {
          showInsufficientCredits();
          // Stop classifying remaining items
          setItems((prev) => prev.map((i) => ({ ...i, isClassifying: false })));
          break;
        }
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, isClassifying: false } : i
          )
        );
      }
    }
    refreshCredits();
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleToggleSelect = (itemId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, isSelected: !i.isSelected } : i
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = items.every((i) => i.isSelected);
    setItems((prev) => prev.map((i) => ({ ...i, isSelected: !allSelected })));
  };

  const handleUpdateItemField = (
    itemId: string,
    field: keyof BatchItemCreate,
    value: unknown
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, formData: { ...i.formData, [field]: value } }
          : i
      )
    );
  };

  const handleCreateItems = () => {
    const selectedItems = items.filter((i) => i.isSelected);
    if (selectedItems.length === 0) return;

    createBatchMutation.mutate(selectedItems);
  };

  const selectedCount = items.filter((i) => i.isSelected).length;
  const unclassifiedCount = items.filter((i) => !i.classification).length;
  const isClassifyingAny = items.some((i) => i.isClassifying);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <InsufficientCreditsModal />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/items">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {tBatch("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{tBatch("description")}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{t("items.step", { number: 1 })}</p>
            <p className="text-muted-foreground text-sm">
              {tBatch("uploadPhotos")}
            </p>
          </div>
        </div>
        <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{t("items.step", { number: 2 })}</p>
            <p className="text-muted-foreground text-sm">
              {tBatch("classifyAll")}
            </p>
          </div>
        </div>
        <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{t("items.step", { number: 3 })}</p>
            <p className="text-muted-foreground text-sm">
              {tBatch("reviewAndCreate")}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {items.length === 0 ? (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "bg-card flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50",
            isUploading && "pointer-events-none opacity-50"
          )}
          data-testid="batch-upload-dropzone"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
            multiple
            aria-label={tBatch("uploadPhotos")}
          />
          <div className="text-center">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="bg-primary/10 rounded-full p-4">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                </div>
                <p className="mt-4 font-medium">{tImages("uploading")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-muted rounded-full p-4">
                  <ImagePlus className="text-muted-foreground h-8 w-8" />
                </div>
                <p className="mt-4 font-medium">
                  {isDragging ? tImages("dragAndDrop") : tBatch("dropPhotos")}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {tBatch("selectMultiple")}
                </p>
              </div>
            )}
          </div>
        </label>
      ) : (
        <>
          {/* Action Bar */}
          <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={items.length > 0 && items.every((i) => i.isSelected)}
                  onCheckedChange={handleSelectAll}
                  data-testid="select-all-checkbox"
                />
                <label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  {tBatch("selectAll")}
                </label>
              </div>
              <span className="text-muted-foreground text-sm">
                {tBatch("selectedCount", { count: selectedCount })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {unclassifiedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClassifyAll}
                  disabled={isClassifyingAny}
                  data-testid="classify-all-button"
                >
                  {isClassifyingAny ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tBilling("analyzing")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {tBatch("classifyAllItems", { count: unclassifiedCount })}
                    </>
                  )}
                </Button>
              )}

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                  aria-label={tBatch("addMore")}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Plus className="mr-2 h-4 w-4" />
                    {tBatch("addMore")}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "bg-card overflow-hidden rounded-xl border transition-all",
                  item.isSelected && "ring-primary ring-2"
                )}
                data-testid={`batch-item-${item.id}`}
              >
                {/* Image */}
                <div className="relative aspect-square">
                  <img
                    src={item.imageUrl}
                    alt={item.filename}
                    className="h-full w-full object-cover"
                  />
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Top row - checkbox and remove */}
                  <div className="absolute top-2 right-2 left-2 flex items-center justify-between">
                    <Checkbox
                      checked={item.isSelected}
                      onCheckedChange={() => handleToggleSelect(item.id)}
                      className="bg-white/90"
                      data-testid={`select-item-${item.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
                      onClick={() => handleRemoveItem(item.id)}
                      data-testid={`remove-item-${item.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Bottom row - classification status */}
                  <div className="absolute right-2 bottom-2 left-2">
                    {item.isClassifying ? (
                      <div className="flex items-center gap-2 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tBilling("analyzing")}
                      </div>
                    ) : item.classification ? (
                      <div className="flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white">
                        <CheckCircle2 className="h-4 w-4" />
                        {tImages("identified")}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleClassifyItem(item.id)}
                        className="w-full gap-2"
                        data-testid={`classify-item-${item.id}`}
                      >
                        <Sparkles className="h-4 w-4" />
                        {tBilling("identifyItem", {
                          cost: imageClassificationCost,
                        })}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3 p-4">
                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {tCommon("name")}
                    </label>
                    <input
                      type="text"
                      value={item.formData.name}
                      onChange={(e) =>
                        handleUpdateItemField(item.id, "name", e.target.value)
                      }
                      className="bg-background focus:border-primary focus:ring-primary/20 h-9 w-full rounded-md border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                      placeholder={t("items.namePlaceholder")}
                      data-testid={`item-name-${item.id}`}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {t("items.quantity")}
                      </label>
                      <input
                        type="number"
                        value={item.formData.quantity}
                        onChange={(e) =>
                          handleUpdateItemField(
                            item.id,
                            "quantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                        min={1}
                        className="bg-background focus:border-primary focus:ring-primary/20 h-9 w-full rounded-md border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                        data-testid={`item-quantity-${item.id}`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {t("items.quantityUnit")}
                      </label>
                      <input
                        type="text"
                        value={item.formData.quantity_unit}
                        onChange={(e) =>
                          handleUpdateItemField(
                            item.id,
                            "quantity_unit",
                            e.target.value
                          )
                        }
                        className="bg-background focus:border-primary focus:ring-primary/20 h-9 w-full rounded-md border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                        data-testid={`item-unit-${item.id}`}
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {t("items.category")}
                    </label>
                    <TreeSelect
                      nodes={categoryTree ?? []}
                      value={item.formData.category_id ?? null}
                      onChange={(value) =>
                        handleUpdateItemField(
                          item.id,
                          "category_id",
                          value ?? undefined
                        )
                      }
                      placeholder={t("items.selectCategory")}
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {t("items.location")}
                    </label>
                    <TreeSelect
                      nodes={locationTreeWithIcons}
                      value={item.formData.location_id ?? null}
                      onChange={(value) =>
                        handleUpdateItemField(
                          item.id,
                          "location_id",
                          value ?? undefined
                        )
                      }
                      placeholder={t("items.selectLocation")}
                    />
                  </div>

                  {/* AI suggestion */}
                  {item.classification?.category_path && (
                    <div className="rounded-md bg-emerald-50 p-2 text-xs dark:bg-emerald-950/30">
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        {t("items.suggestedCategory")}:
                      </span>{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {item.classification.category_path}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="bg-card sticky bottom-0 flex flex-col-reverse gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setItems([])}
                disabled={createBatchMutation.isPending}
                data-testid="clear-all-button"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tBatch("clearAll")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {tBatch("itemCount", { count: items.length })}
              </span>
            </div>

            <div className="flex gap-3">
              <Link href="/items">
                <Button variant="outline">{tCommon("cancel")}</Button>
              </Link>
              <Button
                onClick={handleCreateItems}
                disabled={
                  selectedCount === 0 ||
                  createBatchMutation.isPending ||
                  items.some((i) => i.isSelected && !i.formData.name)
                }
                data-testid="create-all-button"
              >
                {createBatchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("items.creating")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {tBatch("createItems", { count: selectedCount })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 flex items-center gap-3 rounded-xl border p-4">
          <AlertCircle className="text-destructive h-5 w-5" />
          <span className="text-destructive text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
