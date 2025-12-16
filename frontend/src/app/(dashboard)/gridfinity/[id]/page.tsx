"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  Loader2,
  Wand2,
  Search,
  GripVertical,
  X,
  AlertCircle,
  Grid3X3,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  gridfinityApi,
  itemsApi,
  GridfinityPlacement,
  GridfinityPlacementCreate,
  ItemListItem,
  AutoLayoutResult,
  BinRecommendation,
} from "@/lib/api/api-client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type DraggableItem = {
  type: "item" | "placement";
  item?: ItemListItem;
  placement?: GridfinityPlacement;
};

// Pending placement state for the placement dialog
type PendingPlacement = {
  item: ItemListItem;
  gridX: number;
  gridY: number;
  widthUnits: number;
  depthUnits: number;
  recommendation?: BinRecommendation;
};

// Placement being edited
type EditingPlacement = {
  placement: GridfinityPlacement;
  widthUnits: number;
  depthUnits: number;
};

// Gridfinity standard grid unit size in mm
const GRIDFINITY_GRID_UNIT_MM = 42;

// Common bin size presets
const BIN_SIZE_PRESETS = [
  { width: 1, depth: 1, label: "1×1" },
  { width: 1, depth: 2, label: "1×2" },
  { width: 2, depth: 1, label: "2×1" },
  { width: 2, depth: 2, label: "2×2" },
  { width: 2, depth: 3, label: "2×3" },
  { width: 3, depth: 2, label: "3×2" },
  { width: 3, depth: 3, label: "3×3" },
];

// Check if a placement would overlap with existing placements
function checkPlacementOverlap(
  placements: GridfinityPlacement[],
  gridX: number,
  gridY: number,
  widthUnits: number,
  depthUnits: number,
  excludeId?: string
): boolean {
  const newXEnd = gridX + widthUnits;
  const newYEnd = gridY + depthUnits;

  for (const placement of placements) {
    if (excludeId && placement.id === excludeId) {
      continue;
    }

    const existingXEnd = placement.grid_x + placement.width_units;
    const existingYEnd = placement.grid_y + placement.depth_units;

    // Check for overlap using AABB collision detection
    if (
      gridX < existingXEnd &&
      newXEnd > placement.grid_x &&
      gridY < existingYEnd &&
      newYEnd > placement.grid_y
    ) {
      return true;
    }
  }

  return false;
}

export default function GridfinityEditorPage() {
  const params = useParams();
  const unitId = params.id as string;
  const t = useTranslations("gridfinity");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [itemSearch, setItemSearch] = useState("");
  const [activeItem, setActiveItem] = useState<DraggableItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingPlacement | null>(null);
  const [editingPlacement, setEditingPlacement] =
    useState<EditingPlacement | null>(null);

  // Configure pointer sensor with a small activation constraint to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch unit with placements
  const {
    data: unit,
    isLoading: unitLoading,
    error: unitError,
  } = useQuery({
    queryKey: ["gridfinity", "units", unitId, "layout"],
    queryFn: () => gridfinityApi.getUnitLayout(unitId),
  });

  // Fetch items for sidebar
  const { data: itemsData } = useQuery({
    queryKey: ["items", { search: itemSearch }],
    queryFn: () =>
      itemsApi.list({ search: itemSearch || undefined, limit: 50 }),
  });

  // Get available item IDs for bin recommendations
  const availableItemIds = useMemo(() => {
    const placedIds = new Set(unit?.placements?.map((p) => p.item_id) || []);
    return (
      itemsData?.items
        ?.filter((item) => !placedIds.has(item.id))
        .map((i) => i.id) || []
    );
  }, [itemsData?.items, unit?.placements]);

  // Fetch bin recommendations for available items
  const { data: binRecommendations, isLoading: recommendationsLoading } =
    useQuery({
      queryKey: ["gridfinity", "recommendations", availableItemIds],
      queryFn: () => gridfinityApi.recommendBins(availableItemIds),
      enabled: availableItemIds.length > 0,
    });

  // Create a map of recommendations by item ID
  const recommendationsMap = useMemo(() => {
    const map = new Map<string, BinRecommendation>();
    binRecommendations?.recommendations?.forEach((rec) => {
      map.set(rec.item_id, rec);
    });
    return map;
  }, [binRecommendations]);

  // Create placement mutation
  const createPlacementMutation = useMutation({
    mutationFn: (data: GridfinityPlacementCreate) =>
      gridfinityApi.createPlacement(unitId, data),
    onSuccess: () => {
      setErrorMessage(null);
      setPendingPlacement(null);
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Update placement mutation
  const updatePlacementMutation = useMutation({
    mutationFn: ({
      placementId,
      data,
    }: {
      placementId: string;
      data: {
        grid_x?: number;
        grid_y?: number;
        width_units?: number;
        depth_units?: number;
      };
    }) => gridfinityApi.updatePlacement(placementId, data),
    onSuccess: () => {
      setErrorMessage(null);
      setEditingPlacement(null);
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Delete placement mutation
  const deletePlacementMutation = useMutation({
    mutationFn: (placementId: string) =>
      gridfinityApi.deletePlacement(placementId),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Auto-layout mutation
  const autoLayoutMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      gridfinityApi.autoLayout(unitId, itemIds),
    onSuccess: async (result: AutoLayoutResult) => {
      setErrorMessage(null);
      // Create placements using Promise.allSettled for better error handling
      const results = await Promise.allSettled(
        result.placed.map((placement) =>
          gridfinityApi.createPlacement(unitId, {
            item_id: placement.item_id,
            grid_x: placement.grid_x,
            grid_y: placement.grid_y,
            width_units: placement.width_units,
            depth_units: placement.depth_units,
          })
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const successCount = results.length - failures.length;
        setErrorMessage(
          t("autoLayoutPartialError", {
            success: successCount,
            failed: failures.length,
          })
        );
      }

      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Get placed item IDs
  const placedItemIds = useMemo(
    () => new Set(unit?.placements?.map((p) => p.item_id) || []),
    [unit?.placements]
  );

  // Filter items not yet placed
  const availableItems = useMemo(
    () => itemsData?.items?.filter((item) => !placedItemIds.has(item.id)) || [],
    [itemsData?.items, placedItemIds]
  );

  // Create a map of placements by position for quick lookup
  const placementsByPosition = useMemo(() => {
    const map = new Map<string, GridfinityPlacement>();
    unit?.placements?.forEach((p) => {
      // Mark all cells this placement occupies
      for (let dx = 0; dx < p.width_units; dx++) {
        for (let dy = 0; dy < p.depth_units; dy++) {
          map.set(`${p.grid_x + dx},${p.grid_y + dy}`, p);
        }
      }
    });
    return map;
  }, [unit?.placements]);

  // Create item name lookup
  const itemNames = useMemo(() => {
    const names = new Map<string, string>();
    itemsData?.items?.forEach((item) => {
      names.set(item.id, item.name);
    });
    return names;
  }, [itemsData?.items]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DraggableItem;
    setActiveItem(data);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeData = active.data.current as DraggableItem;
    const overData = over.data.current as { x: number; y: number };

    if (activeData.type === "item" && activeData.item) {
      // Show placement dialog with bin size recommendations
      const recommendation = recommendationsMap.get(activeData.item.id);
      // Only use recommendation if it has valid dimensions
      const validRecommendation =
        recommendation?.recommended_width_units &&
        recommendation?.recommended_depth_units
          ? recommendation
          : undefined;
      setPendingPlacement({
        item: activeData.item,
        gridX: overData.x,
        gridY: overData.y,
        widthUnits: validRecommendation?.recommended_width_units || 1,
        depthUnits: validRecommendation?.recommended_depth_units || 1,
        recommendation: validRecommendation,
      });
    } else if (activeData.type === "placement" && activeData.placement) {
      // Moving an existing placement
      updatePlacementMutation.mutate({
        placementId: activeData.placement.id,
        data: { grid_x: overData.x, grid_y: overData.y },
      });
    }
  };

  // Handle confirm placement from dialog
  const handleConfirmPlacement = useCallback(() => {
    if (!pendingPlacement) return;
    createPlacementMutation.mutate({
      item_id: pendingPlacement.item.id,
      grid_x: pendingPlacement.gridX,
      grid_y: pendingPlacement.gridY,
      width_units: pendingPlacement.widthUnits,
      depth_units: pendingPlacement.depthUnits,
    });
  }, [pendingPlacement, createPlacementMutation]);

  // Handle confirm edit placement
  const handleConfirmEditPlacement = useCallback(() => {
    if (!editingPlacement) return;
    updatePlacementMutation.mutate({
      placementId: editingPlacement.placement.id,
      data: {
        width_units: editingPlacement.widthUnits,
        depth_units: editingPlacement.depthUnits,
      },
    });
  }, [editingPlacement, updatePlacementMutation]);

  // Handle opening edit dialog for a placement
  const handleEditPlacement = useCallback((placement: GridfinityPlacement) => {
    setEditingPlacement({
      placement,
      widthUnits: placement.width_units,
      depthUnits: placement.depth_units,
    });
  }, []);

  const handleAutoLayout = () => {
    if (availableItems.length === 0) return;
    autoLayoutMutation.mutate(availableItems.map((item) => item.id));
  };

  // Check if any mutation is in progress
  const isMutating =
    createPlacementMutation.isPending ||
    updatePlacementMutation.isPending ||
    deletePlacementMutation.isPending ||
    autoLayoutMutation.isPending;

  if (unitLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (unitError) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="text-destructive mx-auto h-12 w-12" />
        <p className="text-muted-foreground mt-4">
          {t("loadError", {
            error:
              unitError instanceof Error
                ? unitError.message
                : tCommon("unknownError"),
          })}
        </p>
        <Link href="/gridfinity">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToUnits")}
          </Button>
        </Link>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{t("unitNotFound")}</p>
        <Link href="/gridfinity">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToUnits")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <Link href="/gridfinity">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{unit.name}</h1>
              <p className="text-muted-foreground text-sm">
                {unit.grid_columns} x {unit.grid_rows} {t("grid")} (
                {unit.container_width_mm} x {unit.container_depth_mm} mm)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleAutoLayout}
              disabled={
                autoLayoutMutation.isPending || availableItems.length === 0
              }
            >
              {autoLayoutMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {t("autoLayout")}
            </Button>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="border-destructive/50 bg-destructive/10 flex items-center gap-3 rounded-lg border p-3">
            <AlertCircle className="text-destructive h-5 w-5" />
            <p className="text-destructive flex-1 text-sm">{errorMessage}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setErrorMessage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main content */}
        <div
          className={cn(
            "flex flex-1 gap-4 overflow-hidden pt-4",
            isMutating && "pointer-events-none opacity-70"
          )}
        >
          {/* Grid editor */}
          <div className="flex-1 overflow-auto">
            <div
              className="bg-muted/30 inline-grid gap-1 rounded-lg p-4"
              style={{
                gridTemplateColumns: `repeat(${unit.grid_columns}, minmax(48px, 1fr))`,
              }}
            >
              {Array.from({ length: unit.grid_rows }).map((_, y) =>
                Array.from({ length: unit.grid_columns }).map((_, x) => {
                  const placement = placementsByPosition.get(`${x},${y}`);
                  const isOrigin =
                    placement &&
                    placement.grid_x === x &&
                    placement.grid_y === y;

                  return (
                    <GridCell
                      key={`${x}-${y}`}
                      x={x}
                      y={y}
                      placement={isOrigin ? placement : undefined}
                      isOccupied={!!placement}
                      itemName={
                        placement ? itemNames.get(placement.item_id) : undefined
                      }
                      onDelete={
                        isOrigin
                          ? () => deletePlacementMutation.mutate(placement.id)
                          : undefined
                      }
                      onEdit={
                        isOrigin
                          ? () => handleEditPlacement(placement)
                          : undefined
                      }
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Items sidebar */}
          <div className="flex w-72 flex-col border-l pl-4">
            <div className="border-b pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{t("availableItems")}</h2>
                {recommendationsLoading && (
                  <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("dragToPlace")}
              </p>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  placeholder={tCommon("search")}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-auto">
              {availableItems.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  {t("noAvailableItems")}
                </p>
              ) : (
                availableItems.map((item) => (
                  <DraggableItemCard
                    key={item.id}
                    item={item}
                    recommendation={recommendationsMap.get(item.id)}
                  />
                ))
              )}
            </div>

            {/* Placed items count */}
            <div className="text-muted-foreground border-t pt-3 text-sm">
              {t("placedItems", { count: unit.placements?.length || 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem && (
          <div className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm font-medium shadow-lg">
            {activeItem.type === "item"
              ? activeItem.item?.name
              : activeItem.placement
                ? itemNames.get(activeItem.placement.item_id)
                : "Item"}
          </div>
        )}
      </DragOverlay>

      {/* Placement Dialog */}
      <Dialog
        open={!!pendingPlacement}
        onOpenChange={(open) => !open && setPendingPlacement(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("placementDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("placementDialog.description", {
                item: pendingPlacement?.item.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {pendingPlacement && (
            <div className="space-y-4">
              {/* Recommendation info */}
              {pendingPlacement.recommendation && (
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Grid3X3 className="h-4 w-4" />
                    {t("placementDialog.recommended")}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {pendingPlacement.recommendation.reasoning}
                  </p>
                </div>
              )}

              {/* Size selector */}
              <div className="space-y-2">
                <Label>{t("placementDialog.binSize")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {BIN_SIZE_PRESETS.filter(
                    (preset) =>
                      // Check fits within grid bounds
                      pendingPlacement.gridX + preset.width <=
                        (unit?.grid_columns || 1) &&
                      pendingPlacement.gridY + preset.depth <=
                        (unit?.grid_rows || 1) &&
                      // Check doesn't overlap with other placements
                      !checkPlacementOverlap(
                        unit?.placements || [],
                        pendingPlacement.gridX,
                        pendingPlacement.gridY,
                        preset.width,
                        preset.depth
                      )
                  ).map((preset) => {
                    const isRecommended =
                      preset.width ===
                        pendingPlacement.recommendation
                          ?.recommended_width_units &&
                      preset.depth ===
                        pendingPlacement.recommendation
                          ?.recommended_depth_units;
                    const isSelected =
                      preset.width === pendingPlacement.widthUnits &&
                      preset.depth === pendingPlacement.depthUnits;
                    return (
                      <Button
                        key={preset.label}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "relative",
                          isRecommended && !isSelected && "border-primary"
                        )}
                        onClick={() =>
                          setPendingPlacement((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  widthUnits: preset.width,
                                  depthUnits: preset.depth,
                                }
                              : prev
                          )
                        }
                      >
                        {preset.label}
                        {isRecommended && (
                          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px]">
                            ✓
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Custom size inputs */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>{t("placementDialog.width")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={(unit?.grid_columns || 1) - pendingPlacement.gridX}
                    value={pendingPlacement.widthUnits}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxWidth =
                        (unit?.grid_columns || 1) - pendingPlacement.gridX;
                      setPendingPlacement((prev) =>
                        prev
                          ? {
                              ...prev,
                              widthUnits: Math.max(
                                1,
                                Math.min(value, maxWidth)
                              ),
                            }
                          : prev
                      );
                    }}
                  />
                </div>
                <X className="text-muted-foreground mt-6 h-4 w-4" />
                <div className="flex-1">
                  <Label>{t("placementDialog.depth")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={(unit?.grid_rows || 1) - pendingPlacement.gridY}
                    value={pendingPlacement.depthUnits}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxDepth =
                        (unit?.grid_rows || 1) - pendingPlacement.gridY;
                      setPendingPlacement((prev) =>
                        prev
                          ? {
                              ...prev,
                              depthUnits: Math.max(
                                1,
                                Math.min(value, maxDepth)
                              ),
                            }
                          : prev
                      );
                    }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">
                  {t("placementDialog.preview", {
                    width: pendingPlacement.widthUnits,
                    depth: pendingPlacement.depthUnits,
                    widthMm:
                      pendingPlacement.widthUnits * GRIDFINITY_GRID_UNIT_MM,
                    depthMm:
                      pendingPlacement.depthUnits * GRIDFINITY_GRID_UNIT_MM,
                  })}
                </p>
              </div>

              {/* Overlap warning */}
              {checkPlacementOverlap(
                unit?.placements || [],
                pendingPlacement.gridX,
                pendingPlacement.gridY,
                pendingPlacement.widthUnits,
                pendingPlacement.depthUnits
              ) && (
                <div className="border-destructive bg-destructive/10 flex items-center gap-2 rounded-lg border p-3">
                  <AlertCircle className="text-destructive h-4 w-4" />
                  <p className="text-destructive text-sm">
                    {t("placementDialog.overlapWarning")}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlacement(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleConfirmPlacement}
              disabled={
                createPlacementMutation.isPending ||
                (pendingPlacement !== null &&
                  checkPlacementOverlap(
                    unit?.placements || [],
                    pendingPlacement.gridX,
                    pendingPlacement.gridY,
                    pendingPlacement.widthUnits,
                    pendingPlacement.depthUnits
                  ))
              }
            >
              {createPlacementMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("placementDialog.place")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Placement Dialog */}
      <Dialog
        open={!!editingPlacement}
        onOpenChange={(open) => !open && setEditingPlacement(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editPlacementDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("editPlacementDialog.description")}
            </DialogDescription>
          </DialogHeader>
          {editingPlacement && (
            <div className="space-y-4">
              {/* Size selector */}
              <div className="space-y-2">
                <Label>{t("placementDialog.binSize")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {BIN_SIZE_PRESETS.filter(
                    (preset) =>
                      // Check fits within grid bounds
                      editingPlacement.placement.grid_x + preset.width <=
                        (unit?.grid_columns || 1) &&
                      editingPlacement.placement.grid_y + preset.depth <=
                        (unit?.grid_rows || 1) &&
                      // Check doesn't overlap with other placements
                      !checkPlacementOverlap(
                        unit?.placements || [],
                        editingPlacement.placement.grid_x,
                        editingPlacement.placement.grid_y,
                        preset.width,
                        preset.depth,
                        editingPlacement.placement.id
                      )
                  ).map((preset) => {
                    const isSelected =
                      preset.width === editingPlacement.widthUnits &&
                      preset.depth === editingPlacement.depthUnits;
                    return (
                      <Button
                        key={preset.label}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setEditingPlacement((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  widthUnits: preset.width,
                                  depthUnits: preset.depth,
                                }
                              : prev
                          )
                        }
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Custom size inputs */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>{t("placementDialog.width")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={
                      (unit?.grid_columns || 1) -
                      editingPlacement.placement.grid_x
                    }
                    value={editingPlacement.widthUnits}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxWidth =
                        (unit?.grid_columns || 1) -
                        editingPlacement.placement.grid_x;
                      setEditingPlacement((prev) =>
                        prev
                          ? {
                              ...prev,
                              widthUnits: Math.max(
                                1,
                                Math.min(value, maxWidth)
                              ),
                            }
                          : prev
                      );
                    }}
                  />
                </div>
                <X className="text-muted-foreground mt-6 h-4 w-4" />
                <div className="flex-1">
                  <Label>{t("placementDialog.depth")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={
                      (unit?.grid_rows || 1) - editingPlacement.placement.grid_y
                    }
                    value={editingPlacement.depthUnits}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxDepth =
                        (unit?.grid_rows || 1) -
                        editingPlacement.placement.grid_y;
                      setEditingPlacement((prev) =>
                        prev
                          ? {
                              ...prev,
                              depthUnits: Math.max(
                                1,
                                Math.min(value, maxDepth)
                              ),
                            }
                          : prev
                      );
                    }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">
                  {t("placementDialog.preview", {
                    width: editingPlacement.widthUnits,
                    depth: editingPlacement.depthUnits,
                    widthMm:
                      editingPlacement.widthUnits * GRIDFINITY_GRID_UNIT_MM,
                    depthMm:
                      editingPlacement.depthUnits * GRIDFINITY_GRID_UNIT_MM,
                  })}
                </p>
              </div>

              {/* Overlap warning */}
              {checkPlacementOverlap(
                unit?.placements || [],
                editingPlacement.placement.grid_x,
                editingPlacement.placement.grid_y,
                editingPlacement.widthUnits,
                editingPlacement.depthUnits,
                editingPlacement.placement.id
              ) && (
                <div className="border-destructive bg-destructive/10 flex items-center gap-2 rounded-lg border p-3">
                  <AlertCircle className="text-destructive h-4 w-4" />
                  <p className="text-destructive text-sm">
                    {t("editPlacementDialog.overlapWarning")}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlacement(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleConfirmEditPlacement}
              disabled={
                updatePlacementMutation.isPending ||
                (editingPlacement !== null &&
                  checkPlacementOverlap(
                    unit?.placements || [],
                    editingPlacement.placement.grid_x,
                    editingPlacement.placement.grid_y,
                    editingPlacement.widthUnits,
                    editingPlacement.depthUnits,
                    editingPlacement.placement.id
                  ))
              }
            >
              {updatePlacementMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

// Grid Cell Component
function GridCell({
  x,
  y,
  placement,
  isOccupied,
  itemName,
  onDelete,
  onEdit,
}: {
  x: number;
  y: number;
  placement?: GridfinityPlacement;
  isOccupied: boolean;
  itemName?: string;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${x}-${y}`,
    data: { x, y },
    disabled: isOccupied,
  });

  // If this is the origin of a placement, make it draggable
  if (placement) {
    return (
      <DraggablePlacement
        placement={placement}
        itemName={itemName}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-12 w-12 rounded border-2 border-dashed transition-colors",
        isOccupied
          ? "bg-muted border-transparent"
          : isOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
      )}
    />
  );
}

// Draggable Placement Component
function DraggablePlacement({
  placement,
  itemName,
  onDelete,
  onEdit,
}: {
  placement: GridfinityPlacement;
  itemName?: string;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placement-${placement.id}`,
    data: { type: "placement", placement } as DraggableItem,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-primary bg-primary/20 group relative flex h-12 w-12 items-center justify-center rounded border-2",
        isDragging && "opacity-50"
      )}
      style={{
        gridColumn: `span ${placement.width_units}`,
        gridRow: `span ${placement.depth_units}`,
        width:
          placement.width_units > 1
            ? `${placement.width_units * 48 + (placement.width_units - 1) * 4}px`
            : undefined,
        height:
          placement.depth_units > 1
            ? `${placement.depth_units * 48 + (placement.depth_units - 1) * 4}px`
            : undefined,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
      >
        <span className="truncate px-1 text-center text-xs font-medium">
          {itemName || placement.position_code}
        </span>
      </div>
      {/* Action buttons */}
      <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full"
            data-testid="placement-edit-button"
            aria-label="Resize placement"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="bg-destructive text-destructive-foreground flex h-5 w-5 items-center justify-center rounded-full"
            data-testid="placement-delete-button"
            aria-label="Remove placement"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Draggable Item Card Component
function DraggableItemCard({
  item,
  recommendation,
}: {
  item: ItemListItem;
  recommendation?: BinRecommendation;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { type: "item", item } as DraggableItem,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "hover:bg-muted/50 flex cursor-grab items-center gap-2 rounded border p-2 active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
      data-testid={`item-card-${item.id}`}
    >
      <GripVertical className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {item.location && (
            <span className="truncate">{item.location.name}</span>
          )}
          {recommendation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5">
                  <Grid3X3 className="h-3 w-3" />
                  {recommendation.recommended_width_units}×
                  {recommendation.recommended_depth_units}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                <p className="text-xs">{recommendation.reasoning}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
