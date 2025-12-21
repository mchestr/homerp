"use client";

import { useState, useEffect } from "react";
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
  Printer,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { TreeSelect } from "@/components/ui/tree-view";
import { ImageGallery } from "@/components/items/image-gallery";
import {
  MultiImageUpload,
  UploadedImage,
} from "@/components/items/multi-image-upload";
import { DynamicAttributeForm } from "@/components/items/dynamic-attribute-form";
import { SpecificationEditor } from "@/components/items/specification-editor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  itemsApi,
  imagesApi,
  categoriesApi,
  locationsApi,
  CheckInOutCreate,
  ItemUpdate,
  LocationTreeNode,
} from "@/lib/api/api";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useTranslations } from "next-intl";
import { useLabelPrintModal } from "@/components/labels";
import type { LabelData } from "@/lib/labels";
import { useToast } from "@/hooks/use-toast";

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
    children: addIconsToLocationTree(node.children ?? []),
  }));
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const itemId = params.id as string;
  const t = useTranslations("checkInOut");
  const tCommon = useTranslations("common");
  const tItems = useTranslations("items");

  const [checkInOutQuantity, setCheckInOutQuantity] = useState(1);
  const [checkInOutNotes, setCheckInOutNotes] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<ItemUpdate>({
    name: "",
    description: "",
    category_id: undefined,
    location_id: undefined,
    quantity: 1,
    quantity_unit: "pcs",
    min_quantity: undefined,
    price: undefined,
    attributes: {},
  });
  const [categoryAttributes, setCategoryAttributes] = useState<
    Record<string, unknown>
  >({});
  const [specifications, setSpecifications] = useState<Record<string, unknown>>(
    {}
  );
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(
    null
  );

  const {
    confirm,
    setIsLoading: setDeleteLoading,
    ConfirmModal,
  } = useConfirmModal();

  const { openLabelModal, LabelPrintModal } = useLabelPrintModal();
  const tLabels = useTranslations("labels");
  const { toast } = useToast();
  const tImages = useTranslations("images");

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

  // Edit mode queries
  const { data: categoryTree } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoriesApi.tree(),
    enabled: isEditMode,
  });

  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
    enabled: isEditMode,
  });

  const { data: categoryTemplate } = useQuery({
    queryKey: ["categories", formData.category_id, "template"],
    queryFn: () => categoriesApi.getTemplate(formData.category_id!),
    enabled: !!formData.category_id && isEditMode,
  });

  const locationTreeWithIcons = locationTree
    ? addIconsToLocationTree(locationTree)
    : [];

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

  const setPrimaryImageMutation = useMutation({
    mutationFn: (imageId: string) => imagesApi.setPrimary(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: tCommon("success"),
        description: tImages("primaryImageSet"),
      });
    },
    onError: () => {
      toast({
        title: tCommon("error"),
        description: tImages("setPrimaryFailed"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ItemUpdate) => itemsApi.update(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      setIsEditMode(false);
      toast({
        title: tCommon("success"),
        description: tItems("itemUpdated"),
      });
    },
    onError: () => {
      toast({
        title: tCommon("error"),
        description: tCommon("unknownError"),
        variant: "destructive",
      });
    },
  });

  // Populate form when entering edit mode
  useEffect(() => {
    if (isEditMode && item) {
      const { attributes, ...rest } = item;
      const categoryAttrs: Record<string, unknown> = {};
      const otherAttrs: Record<string, unknown> = {};
      let specs: Record<string, unknown> = {};

      if (attributes && typeof attributes === "object") {
        for (const [key, value] of Object.entries(attributes)) {
          if (key === "specifications") {
            specs =
              typeof value === "object" && value !== null
                ? (value as Record<string, unknown>)
                : {};
          } else if (key.startsWith("ai_")) {
            otherAttrs[key] = value;
          } else {
            categoryAttrs[key] = value;
          }
        }
      }

      setFormData({
        name: rest.name,
        description: rest.description || "",
        category_id: rest.category_id || undefined,
        location_id: rest.location_id || undefined,
        quantity: rest.quantity,
        quantity_unit: rest.quantity_unit,
        min_quantity: rest.min_quantity || undefined,
        price: rest.price != null ? Number(rest.price) : undefined,
        attributes: otherAttrs,
      });
      setCategoryAttributes(categoryAttrs);
      setSpecifications(specs);
    }
  }, [isEditMode, item]);

  // Track initial category ID
  useEffect(() => {
    if (item && initialCategoryId === null) {
      setInitialCategoryId(item.category_id ?? null);
    }
  }, [item, initialCategoryId]);

  // Reset category attributes when category changes
  useEffect(() => {
    if (
      isEditMode &&
      initialCategoryId !== null &&
      formData.category_id !== initialCategoryId
    ) {
      setCategoryAttributes({});
    }
  }, [formData.category_id, initialCategoryId, isEditMode]);

  const handleSetPrimary = async (imageId: string) => {
    await setPrimaryImageMutation.mutateAsync(imageId);
  };

  const handleImageUploaded = async (image: UploadedImage) => {
    try {
      // Attach the uploaded image to the item
      await imagesApi.attachToItem(image.id, itemId, false);
      // Clear the uploaded images state
      setUploadedImages([]);
      // Refresh the item data to show the new image
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: tCommon("success"),
        description: tImages("imageUploaded"),
      });
    } catch (error: unknown) {
      // Handle max images error
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 400
      ) {
        toast({
          title: tCommon("error"),
          description: tImages("maxImagesReached"),
          variant: "destructive",
        });
      } else {
        toast({
          title: tCommon("error"),
          description: tImages("uploadFailed"),
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveUploadedImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSetUploadedPrimary = (id: string) => {
    setUploadedImages((prev) =>
      prev.map((img) => ({ ...img, isPrimary: img.id === id }))
    );
  };

  const handleClassificationComplete = () => {
    // Not used for item detail page uploads, only for new item creation
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: tItems("deleteConfirmTitle"),
      message: tItems("deleteConfirmMessage", { name: item?.name ?? "" }),
      confirmLabel: tCommon("delete"),
      cancelLabel: tCommon("cancel"),
      variant: "danger",
    });
    if (!confirmed) return;
    setDeleteLoading(true);
    deleteMutation.mutate();
  };

  const handleQuantityChange = (delta: number) => {
    if (!item) return;
    const newQuantity = Math.max(0, (item.quantity ?? 0) + delta);
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

  const handlePrintLabel = () => {
    if (!item) return;
    const labelData: LabelData = {
      type: "item",
      id: item.id,
      name: item.name,
      category: item.category?.name,
      location: item.location?.name,
      description: item.description ?? undefined,
      qrUrl: `${window.location.origin}/items/${item.id}`,
    };
    openLabelModal(labelData);
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

  const handleSaveEdit = () => {
    const finalAttributes = {
      ...formData.attributes,
      ...categoryAttributes,
      specifications,
    };

    updateMutation.mutate({
      ...formData,
      attributes: finalAttributes,
    });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground text-sm">
            {tItems("loadingItem")}
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-muted rounded-full p-4">
          <Package className="text-muted-foreground h-10 w-10" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">{tItems("itemNotFound")}</h2>
        <p className="text-muted-foreground mt-1">
          {tItems("itemNotFoundDescription")}
        </p>
        <Link href="/items" className="mt-6">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tItems("backToItems")}
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
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
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
          {!isEditMode && (
            <>
              <Button
                variant="outline"
                onClick={handlePrintLabel}
                className="gap-2"
                data-testid="print-label-button"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {tLabels("printLabel")}
                </span>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsEditMode(true)}
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">{tCommon("edit")}</span>
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {deleteMutation.isPending
                    ? tItems("deleting")
                    : tCommon("delete")}
                </span>
              </Button>
            </>
          )}
          {isEditMode && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="w-full sm:w-auto"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending || !formData.name}
                className="w-full sm:w-auto"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">{tItems("saving")}</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <span>{tCommon("save")}</span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          {!isEditMode && (
            <>
              <div className="bg-card overflow-hidden rounded-xl border p-4">
                <ImageGallery
                  images={item.images || []}
                  onSetPrimary={handleSetPrimary}
                  editable={true}
                />
              </div>
              <div className="bg-card rounded-xl border p-4">
                <h2 className="mb-4 font-semibold">{tImages("uploadImage")}</h2>
                <MultiImageUpload
                  onImageUploaded={handleImageUploaded}
                  onClassificationComplete={handleClassificationComplete}
                  uploadedImages={uploadedImages}
                  onRemoveImage={handleRemoveUploadedImage}
                  onSetPrimary={handleSetUploadedPrimary}
                  maxImages={10}
                />
              </div>
            </>
          )}

          {isEditMode && (
            <div className="bg-card rounded-xl border p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">
                {tItems("itemDetails")}
              </h2>
              <div className="space-y-5">
                {/* Name field */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {tCommon("name")}{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name ?? ""}
                    onChange={handleInputChange}
                    required
                    className="bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-lg border px-4 text-base transition-colors focus:ring-2 focus:outline-hidden"
                    placeholder={tItems("namePlaceholder")}
                  />
                </div>

                {/* Description field */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {tCommon("description")}
                  </label>
                  <textarea
                    name="description"
                    value={formData.description || ""}
                    onChange={handleInputChange}
                    rows={3}
                    className="bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-base transition-colors focus:ring-2 focus:outline-hidden"
                    placeholder={tItems("descriptionPlaceholder")}
                  />
                </div>

                {/* Category and Location - side by side on desktop */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("category")}
                    </label>
                    <TreeSelect
                      nodes={categoryTree ?? []}
                      value={formData.category_id ?? null}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          category_id: value ?? undefined,
                        }))
                      }
                      placeholder={tItems("selectCategory")}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("location")}
                    </label>
                    <TreeSelect
                      nodes={locationTreeWithIcons}
                      value={formData.location_id ?? null}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          location_id: value ?? undefined,
                        }))
                      }
                      placeholder={tItems("selectLocation")}
                    />
                  </div>
                </div>

                {/* Quantity, Unit, Min Quantity, Price - grid on desktop */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("quantity")}
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity ?? ""}
                      onChange={handleInputChange}
                      min={0}
                      className="bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-lg border px-4 text-base transition-colors focus:ring-2 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("quantityUnit")}
                    </label>
                    <input
                      type="text"
                      name="quantity_unit"
                      value={formData.quantity_unit ?? ""}
                      onChange={handleInputChange}
                      className="bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-lg border px-4 text-base transition-colors focus:ring-2 focus:outline-hidden"
                      placeholder={tItems("unitPlaceholder")}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("minQuantity")}
                    </label>
                    <input
                      type="number"
                      name="min_quantity"
                      value={formData.min_quantity ?? ""}
                      onChange={handleInputChange}
                      min={0}
                      className="bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-lg border px-4 text-base transition-colors focus:ring-2 focus:outline-hidden"
                      placeholder={tItems("alertThreshold")}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {tItems("price")}
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price ?? ""}
                      onChange={handleInputChange}
                      min={0}
                      step={0.01}
                      className="bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-lg border px-4 text-base transition-colors focus:ring-2 focus:outline-hidden"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Category-specific attributes */}
                {categoryTemplate &&
                  (categoryTemplate.fields?.length ?? 0) > 0 && (
                    <div className="border-t pt-5">
                      <DynamicAttributeForm
                        fields={categoryTemplate.fields!}
                        values={categoryAttributes}
                        onChange={setCategoryAttributes}
                      />
                    </div>
                  )}

                {/* Specifications editor */}
                <div className="border-t pt-5">
                  <SpecificationEditor
                    specifications={specifications}
                    onChange={setSpecifications}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {!isEditMode && (
            <>
              <div className="bg-card rounded-xl border p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{tItems("quantity")}</h2>
                  {item.min_quantity != null && (
                    <span className="text-muted-foreground text-sm">
                      {tItems("minQuantity")}: {String(item.min_quantity)}{" "}
                      {item.quantity_unit}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={
                      (item.quantity ?? 0) === 0 ||
                      updateQuantityMutation.isPending
                    }
                    className="h-12 w-12 rounded-full"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <div className="text-center">
                    <span
                      className={cn(
                        "text-4xl font-bold tabular-nums",
                        item.is_low_stock &&
                          "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {item.quantity ?? 0}
                    </span>
                    <p className="text-muted-foreground text-sm">
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
                    {tItems("stockBelowMinimum")}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border p-5">
                <h2 className="font-semibold">{tItems("organization")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2 dark:bg-emerald-400/10">
                      <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {tItems("category")}
                      </p>
                      <p className="truncate font-medium">
                        {item.category?.icon}{" "}
                        {item.category?.name ?? tItems("uncategorized")}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                    <div className="rounded-lg bg-violet-500/10 p-2 dark:bg-violet-400/10">
                      <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {tItems("location")}
                      </p>
                      <p className="truncate font-medium">
                        {item.location?.name ?? tItems("noLocation")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {item.price != null && (
                <div className="bg-card rounded-xl border p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-500/10 p-2 dark:bg-green-400/10">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {tItems("price")}
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatPrice(item.price, user?.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {item.description && (
                <div className="bg-card rounded-xl border p-5">
                  <h2 className="font-semibold">{tCommon("description")}</h2>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}

              {(() => {
                const attrs = item.attributes;
                if (!attrs || typeof attrs !== "object") return null;
                const specs = (attrs as Record<string, unknown>)[
                  "specifications"
                ];
                if (!specs || typeof specs !== "object") return null;
                const entries = Object.entries(
                  specs as Record<string, unknown>
                );
                if (entries.length === 0) return null;
                return (
                  <div className="bg-card rounded-xl border p-5">
                    <div className="flex items-center gap-2">
                      <Tag className="text-muted-foreground h-4 w-4" />
                      <h2 className="font-semibold">
                        {tItems("specifications")}
                      </h2>
                    </div>
                    <dl className="mt-4 space-y-3">
                      {entries.map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
                        >
                          <dt className="text-muted-foreground text-sm capitalize">
                            {key.replace(/_/g, " ")}
                          </dt>
                          <dd className="text-sm font-medium">
                            {typeof value === "string" ||
                            typeof value === "number"
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
              <div className="bg-card rounded-xl border p-5">
                <div className="flex items-center gap-2">
                  <LogOut className="text-muted-foreground h-4 w-4" />
                  <h2 className="font-semibold">{t("checkInOut")}</h2>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <label className="text-muted-foreground w-20 text-sm">
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
                    <label className="text-muted-foreground w-20 text-sm">
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1">
                            <Button
                              variant="outline"
                              onClick={handleCheckOut}
                              disabled={
                                checkOutMutation.isPending ||
                                checkInMutation.isPending ||
                                !item ||
                                !usageStats ||
                                (item.quantity ?? 0) -
                                  usageStats.currently_checked_out <=
                                  0 ||
                                checkInOutQuantity >
                                  (item.quantity ?? 0) -
                                    usageStats.currently_checked_out
                              }
                              className="w-full gap-2"
                            >
                              <LogOut className="h-4 w-4" />
                              {checkOutMutation.isPending
                                ? tCommon("loading")
                                : t("checkOut")}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {item &&
                          usageStats &&
                          (item.quantity ?? 0) -
                            usageStats.currently_checked_out <=
                            0 && (
                            <TooltipContent>
                              <p>{t("checkOutDisabled")}</p>
                            </TooltipContent>
                          )}
                        {item &&
                          usageStats &&
                          (item.quantity ?? 0) -
                            usageStats.currently_checked_out >
                            0 &&
                          checkInOutQuantity >
                            (item.quantity ?? 0) -
                              usageStats.currently_checked_out && (
                            <TooltipContent>
                              <p>
                                {t("exceedsAvailable", {
                                  count:
                                    (item.quantity ?? 0) -
                                    usageStats.currently_checked_out,
                                })}
                              </p>
                            </TooltipContent>
                          )}
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1">
                            <Button
                              variant="outline"
                              onClick={handleCheckIn}
                              disabled={
                                checkOutMutation.isPending ||
                                checkInMutation.isPending ||
                                !usageStats ||
                                usageStats.currently_checked_out <= 0 ||
                                checkInOutQuantity >
                                  usageStats.currently_checked_out
                              }
                              className="w-full gap-2"
                            >
                              <LogIn className="h-4 w-4" />
                              {checkInMutation.isPending
                                ? tCommon("loading")
                                : t("checkIn")}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {usageStats &&
                          usageStats.currently_checked_out <= 0 && (
                            <TooltipContent>
                              <p>{t("checkInDisabled")}</p>
                            </TooltipContent>
                          )}
                        {usageStats &&
                          usageStats.currently_checked_out > 0 &&
                          checkInOutQuantity >
                            usageStats.currently_checked_out && (
                            <TooltipContent>
                              <p>
                                {t("exceedsCheckedOut", {
                                  count: usageStats.currently_checked_out,
                                })}
                              </p>
                            </TooltipContent>
                          )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Usage Stats Card */}
              {usageStats && (
                <div className="bg-card rounded-xl border p-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="text-muted-foreground h-4 w-4" />
                    <h2 className="font-semibold">{t("usageStats")}</h2>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        {t("totalCheckOuts")}
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {usageStats.total_check_outs}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        {t("totalCheckIns")}
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {usageStats.total_check_ins}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
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
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        {t("lastUsed")}
                      </p>
                      <p className="text-sm font-medium">
                        {usageStats.last_check_out
                          ? new Date(
                              usageStats.last_check_out
                            ).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* History Card */}
              {historyData && historyData.items.length > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <div className="flex items-center gap-2">
                    <History className="text-muted-foreground h-4 w-4" />
                    <h2 className="font-semibold">{t("history")}</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {historyData.items.map((record) => (
                      <div
                        key={record.id}
                        className="bg-muted/50 flex items-start gap-3 rounded-lg p-3"
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
                            <p className="text-muted-foreground truncate text-xs">
                              {record.notes}
                            </p>
                          )}
                          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {new Date(record.occurred_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {historyData.total > 5 && (
                      <p className="text-muted-foreground text-center text-xs">
                        {t("showingRecentHistory", {
                          count: historyData.total,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {isEditMode && (
            <div className="bg-card rounded-xl border p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">
                {tImages("images")}
              </h2>
              <div className="space-y-4">
                <ImageGallery
                  images={item.images || []}
                  onSetPrimary={handleSetPrimary}
                  editable={true}
                />

                <div className="border-t pt-4">
                  <h3 className="mb-4 font-semibold">
                    {tImages("uploadImage")}
                  </h3>
                  <MultiImageUpload
                    onImageUploaded={handleImageUploaded}
                    onClassificationComplete={handleClassificationComplete}
                    uploadedImages={uploadedImages}
                    onRemoveImage={handleRemoveUploadedImage}
                    onSetPrimary={handleSetUploadedPrimary}
                    maxImages={10}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal />
      <LabelPrintModal />
    </div>
  );
}
