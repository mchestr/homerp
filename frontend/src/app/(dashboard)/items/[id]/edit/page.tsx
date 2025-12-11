"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TreeSelect } from "@/components/ui/tree-view";
import { DynamicAttributeForm } from "@/components/items/dynamic-attribute-form";
import {
  itemsApi,
  categoriesApi,
  locationsApi,
  ItemUpdate,
  LocationTreeNode,
} from "@/lib/api/api-client";

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

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const itemId = params.id as string;

  const [categoryAttributes, setCategoryAttributes] = useState<
    Record<string, unknown>
  >({});

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

  const { data: item, isLoading: isLoadingItem } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.get(itemId),
  });

  const { data: categoryTree } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoriesApi.tree(),
  });

  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  const { data: categoryTemplate } = useQuery({
    queryKey: ["categories", formData.category_id, "template"],
    queryFn: () => categoriesApi.getTemplate(formData.category_id!),
    enabled: !!formData.category_id,
  });

  // Populate form when item loads
  useEffect(() => {
    if (item) {
      const { attributes, ...rest } = item;
      // Separate category-specific attributes from other attributes
      const categoryAttrs: Record<string, unknown> = {};
      const otherAttrs: Record<string, unknown> = {};

      if (attributes && typeof attributes === "object") {
        for (const [key, value] of Object.entries(attributes)) {
          // Keep specifications and ai_ prefixed fields in main attributes
          if (key === "specifications" || key.startsWith("ai_")) {
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
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data: ItemUpdate) => itemsApi.update(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      router.push(`/items/${itemId}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalAttributes = {
      ...formData.attributes,
      ...categoryAttributes,
    };

    updateMutation.mutate({
      ...formData,
      attributes: finalAttributes,
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

  // Reset category attributes when category changes (but not on initial load)
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(
    null
  );
  useEffect(() => {
    if (item && initialCategoryId === null) {
      setInitialCategoryId(item.category_id);
    }
  }, [item, initialCategoryId]);

  useEffect(() => {
    if (
      initialCategoryId !== null &&
      formData.category_id !== initialCategoryId
    ) {
      setCategoryAttributes({});
    }
  }, [formData.category_id, initialCategoryId]);

  const locationTreeWithIcons = locationTree
    ? addIconsToLocationTree(locationTree)
    : [];

  if (isLoadingItem) {
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/items/${itemId}`}>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Edit Item
          </h1>
          <p className="mt-1 text-muted-foreground">
            Update the details for {item.name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="name"
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
                value={formData.quantity}
                onChange={handleInputChange}
                min={0}
                className="h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Unit</label>
              <input
                type="text"
                name="quantity_unit"
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
          <Link href={`/items/${itemId}`} className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={updateMutation.isPending || !formData.name}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
