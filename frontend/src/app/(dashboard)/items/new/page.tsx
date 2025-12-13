"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Upload,
  Package,
  CheckCircle2,
  FolderPlus,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TreeSelect } from "@/components/ui/tree-view";
import { TagInput } from "@/components/ui/tag-input";
import { ImageUpload } from "@/components/items/image-upload";
import { DynamicAttributeForm } from "@/components/items/dynamic-attribute-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  itemsApi,
  categoriesApi,
  locationsApi,
  imagesApi,
  ClassificationResult,
  ItemCreate,
  LocationTreeNode,
} from "@/lib/api/api-client";
import { parseQuantityEstimate } from "@/lib/utils";
import { useTranslations } from "next-intl";

type UploadedImage = {
  id: string;
  url: string;
  filename: string;
  aiProcessed?: boolean;
};

// Add icons to location tree for display
const LOCATION_TYPES: Record<string, string> = {
  room: "🏠",
  shelf: "📚",
  bin: "🗑️",
  drawer: "🗄️",
  box: "📦",
  cabinet: "🚪",
};

function addIconsToLocationTree(
  nodes: LocationTreeNode[]
): (LocationTreeNode & { icon: string })[] {
  return nodes.map((node) => ({
    ...node,
    icon: LOCATION_TYPES[node.location_type || ""] || "📍",
    children: addIconsToLocationTree(node.children),
  }));
}

export default function NewItemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations();

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<
    Record<string, unknown>
  >({});
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoriesCreated, setCategoriesCreated] = useState(false);
  const [initialImageLoaded, setInitialImageLoaded] = useState(false);
  const [quantityEstimateRaw, setQuantityEstimateRaw] = useState<string | null>(
    null
  );

  const [formData, setFormData] = useState<ItemCreate>({
    name: "",
    description: "",
    category_id: undefined,
    location_id: undefined,
    quantity: 1,
    quantity_unit: "pcs",
    min_quantity: undefined,
    price: undefined,
    attributes: {},
    tags: [],
  });

  // Handle image_id from URL (from "Create Item from This" in classified images)
  const imageIdFromUrl = searchParams.get("image_id");

  useEffect(() => {
    if (imageIdFromUrl && !initialImageLoaded) {
      const loadInitialImage = async () => {
        try {
          const imageData = await imagesApi.get(imageIdFromUrl);
          const { url } = await imagesApi.getSignedUrl(imageIdFromUrl);

          // Add to uploaded images
          setUploadedImages([
            {
              id: imageIdFromUrl,
              url,
              filename: imageData.original_filename || "image",
              aiProcessed: imageData.ai_processed,
            },
          ]);

          // If AI processed, populate the classification and form
          if (imageData.ai_processed && imageData.ai_result) {
            const result = imageData.ai_result as ClassificationResult;
            setClassification(result);

            // Parse quantity estimate
            const parsedQuantity = parseQuantityEstimate(
              result.quantity_estimate
            );
            if (result.quantity_estimate) {
              setQuantityEstimateRaw(result.quantity_estimate);
            }

            setFormData((prev) => ({
              ...prev,
              name: result.identified_name,
              description: result.description,
              quantity: parsedQuantity.quantity,
              quantity_unit: parsedQuantity.quantity_unit,
              attributes: {
                ...prev.attributes,
                specifications: result.specifications,
                ai_confidence: result.confidence,
                ai_category_suggestion: result.category_path,
              },
            }));
          }

          setInitialImageLoaded(true);
        } catch (err) {
          console.error("Failed to load image from URL:", err);
          setInitialImageLoaded(true);
        }
      };

      loadInitialImage();
    }
  }, [imageIdFromUrl, initialImageLoaded]);

  const { data: categoryTree } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoriesApi.tree(),
  });

  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  // Fetch all tags for suggestions
  const { data: allTags } = useQuery({
    queryKey: ["items", "tags"],
    queryFn: () => itemsApi.tags(),
  });

  // Fetch category template when category changes
  const { data: categoryTemplate } = useQuery({
    queryKey: ["categories", formData.category_id, "template"],
    queryFn: () => categoriesApi.getTemplate(formData.category_id!),
    enabled: !!formData.category_id,
  });

  const createMutation = useMutation({
    mutationFn: (data: ItemCreate) => itemsApi.create(data),
    onSuccess: async (item) => {
      for (const image of uploadedImages) {
        await imagesApi.attachToItem(
          image.id,
          item.id,
          image.id === uploadedImages[0]?.id
        );
      }
      queryClient.invalidateQueries({ queryKey: ["items"] });
      router.push(`/items/${item.id}`);
    },
  });

  const createCategoriesMutation = useMutation({
    mutationFn: (path: string) => categoriesApi.createFromPath(path),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["categories", "tree"] });
      setFormData((prev) => ({
        ...prev,
        category_id: category.id,
      }));
      setCategoriesCreated(true);
      setShowCategoryDialog(false);
    },
  });

  const handleImageUploaded = (image: UploadedImage) => {
    setUploadedImages((prev) => [...prev, image]);
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleClassificationComplete = (result: ClassificationResult) => {
    setClassification(result);

    // Parse quantity estimate
    const parsedQuantity = parseQuantityEstimate(result.quantity_estimate);
    if (result.quantity_estimate) {
      setQuantityEstimateRaw(result.quantity_estimate);
    }

    setFormData((prev) => ({
      ...prev,
      name: result.identified_name,
      description: result.description,
      quantity: parsedQuantity.quantity,
      quantity_unit: parsedQuantity.quantity_unit,
      attributes: {
        ...prev.attributes,
        specifications: result.specifications,
        ai_confidence: result.confidence,
        ai_category_suggestion: result.category_path,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Merge category attributes into the main attributes
    const finalAttributes = {
      ...formData.attributes,
      ...categoryAttributes,
    };

    createMutation.mutate({
      ...formData,
      attributes: finalAttributes,
      image_ids: uploadedImages.map((img) => img.id),
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "min_quantity" || name === "price"
          ? value
            ? Number(value)
            : undefined
          : value || undefined,
    }));
  };

  // Reset category attributes when category changes
  useEffect(() => {
    setCategoryAttributes({});
  }, [formData.category_id]);

  const locationTreeWithIcons = locationTree
    ? addIconsToLocationTree(locationTree)
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/items">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Add New Item
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upload a photo to automatically identify your item
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Step 1</p>
            <p className="text-sm text-muted-foreground">Upload image</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Step 2</p>
            <p className="text-sm text-muted-foreground">Auto-identify</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Step 3</p>
            <p className="text-sm text-muted-foreground">Review & save</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            1
          </div>
          <h2 className="text-lg font-semibold">Upload Image</h2>
        </div>
        <ImageUpload
          onImageUploaded={handleImageUploaded}
          onClassificationComplete={handleClassificationComplete}
          uploadedImages={uploadedImages}
          onRemoveImage={handleRemoveImage}
        />
      </div>

      {classification && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Item Identified
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-white/60 p-3 dark:bg-black/20">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Identified as
              </p>
              <p className="mt-1 font-semibold text-emerald-900 dark:text-emerald-200">
                {classification.identified_name}
              </p>
            </div>
            <div className="rounded-lg bg-white/60 p-3 dark:bg-black/20">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Confidence
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.round(classification.confidence * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {Math.round(classification.confidence * 100)}%
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Suggested category
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  {classification.category_path}
                </p>
                {categoriesCreated ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    <Check className="h-3 w-3" />
                    Created
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                    onClick={() => setShowCategoryDialog(true)}
                  >
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                    Create Categories
                  </Button>
                )}
              </div>
            </div>
            {Object.keys(classification.specifications).length > 0 && (
              <div className="rounded-lg bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Detected specifications
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(classification.specifications).map(
                    ([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      >
                        {key}: {String(value)}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            2
          </div>
          <h2 className="text-lg font-semibold">Item Details</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="name"
              data-testid="item-name-input"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g., M3x16mm Pan Head Screws"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-lg border bg-background px-4 py-3 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Optional description of the item"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Category</label>
              <TreeSelect
                nodes={categoryTree ?? []}
                value={formData.category_id ?? null}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    category_id: value ?? undefined,
                  }))
                }
                placeholder="Select category"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Location</label>
              <TreeSelect
                nodes={locationTreeWithIcons}
                value={formData.location_id ?? null}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    location_id: value ?? undefined,
                  }))
                }
                placeholder="Select location"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Quantity</label>
              <input
                type="number"
                name="quantity"
                data-testid="item-quantity-input"
                value={formData.quantity}
                onChange={handleInputChange}
                min={0}
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {quantityEstimateRaw && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("items.quantityEstimateFromAi", {
                    estimate: quantityEstimateRaw,
                  })}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Unit</label>
              <input
                type="text"
                name="quantity_unit"
                data-testid="item-quantity-unit-input"
                value={formData.quantity_unit}
                onChange={handleInputChange}
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="pcs, meters, etc."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Min Quantity
              </label>
              <input
                type="number"
                name="min_quantity"
                value={formData.min_quantity ?? ""}
                onChange={handleInputChange}
                min={0}
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Alert threshold"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Price</label>
              <input
                type="number"
                name="price"
                value={formData.price ?? ""}
                onChange={handleInputChange}
                min={0}
                step={0.01}
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-sm font-medium">Tags</label>
            <TagInput
              value={formData.tags || []}
              onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
              suggestions={allTags?.map((t) => t.value) || []}
              placeholder="Add tags for search aliases..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Press Enter or comma to add. Tags help with search.
            </p>
          </div>

          {/* Dynamic Category Attributes */}
          {categoryTemplate && categoryTemplate.fields.length > 0 && (
            <div className="border-t pt-5">
              <DynamicAttributeForm
                fields={categoryTemplate.fields}
                values={categoryAttributes}
                onChange={setCategoryAttributes}
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <Link href="/items" className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={createMutation.isPending || !formData.name}
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Item"
            )}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Category Hierarchy?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will create the following categories:</p>
                <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
                  {classification?.category_path
                    .split(">")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((segment, index, arr) => (
                      <li key={index}>
                        <span className="font-medium">{segment}</span>
                        {index > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            (under {arr[index - 1]})
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
                <p className="text-sm">
                  Existing categories with matching names will be reused.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (classification?.category_path) {
                  createCategoriesMutation.mutate(classification.category_path);
                }
              }}
              disabled={createCategoriesMutation.isPending}
            >
              {createCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
