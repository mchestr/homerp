"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  gridfinityApi,
  itemsApi,
  GridfinityPlacement,
  GridfinityPlacementCreate,
  ItemListItem,
  AutoLayoutResult,
} from "@/lib/api/api-client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type DraggableItem = {
  type: "item" | "placement";
  item?: ItemListItem;
  placement?: GridfinityPlacement;
};

export default function GridfinityEditorPage() {
  const params = useParams();
  const unitId = params.id as string;
  const t = useTranslations("gridfinity");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [itemSearch, setItemSearch] = useState("");
  const [activeItem, setActiveItem] = useState<DraggableItem | null>(null);

  // Configure pointer sensor with a small activation constraint to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch unit with placements
  const { data: unit, isLoading: unitLoading } = useQuery({
    queryKey: ["gridfinity", "units", unitId, "layout"],
    queryFn: () => gridfinityApi.getUnitLayout(unitId),
  });

  // Fetch items for sidebar
  const { data: itemsData } = useQuery({
    queryKey: ["items", { search: itemSearch }],
    queryFn: () =>
      itemsApi.list({ search: itemSearch || undefined, limit: 50 }),
  });

  // Create placement mutation
  const createPlacementMutation = useMutation({
    mutationFn: (data: GridfinityPlacementCreate) =>
      gridfinityApi.createPlacement(unitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
  });

  // Update placement mutation
  const updatePlacementMutation = useMutation({
    mutationFn: ({
      placementId,
      data,
    }: {
      placementId: string;
      data: { grid_x: number; grid_y: number };
    }) => gridfinityApi.updatePlacement(placementId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
  });

  // Delete placement mutation
  const deletePlacementMutation = useMutation({
    mutationFn: (placementId: string) =>
      gridfinityApi.deletePlacement(placementId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units", unitId, "layout"],
      });
    },
  });

  // Auto-layout mutation
  const autoLayoutMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      gridfinityApi.autoLayout(unitId, itemIds),
    onSuccess: (result: AutoLayoutResult) => {
      // Create placements for all placed items
      result.placed.forEach((placement) => {
        createPlacementMutation.mutate({
          item_id: placement.item_id,
          grid_x: placement.grid_x,
          grid_y: placement.grid_y,
          width_units: placement.width_units,
          depth_units: placement.depth_units,
        });
      });
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
      // Dropping a new item from the sidebar
      createPlacementMutation.mutate({
        item_id: activeData.item.id,
        grid_x: overData.x,
        grid_y: overData.y,
        width_units: 1,
        depth_units: 1,
      });
    } else if (activeData.type === "placement" && activeData.placement) {
      // Moving an existing placement
      updatePlacementMutation.mutate({
        placementId: activeData.placement.id,
        data: { grid_x: overData.x, grid_y: overData.y },
      });
    }
  };

  const handleAutoLayout = () => {
    if (availableItems.length === 0) return;
    autoLayoutMutation.mutate(availableItems.map((item) => item.id));
  };

  if (unitLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">
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

        {/* Main content */}
        <div className="flex flex-1 gap-4 overflow-hidden pt-4">
          {/* Grid editor */}
          <div className="flex-1 overflow-auto">
            <div
              className="inline-grid gap-1 rounded-lg bg-muted/30 p-4"
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
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Items sidebar */}
          <div className="flex w-72 flex-col border-l pl-4">
            <div className="border-b pb-3">
              <h2 className="font-semibold">{t("availableItems")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("dragToPlace")}
              </p>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
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
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("noAvailableItems")}
                </p>
              ) : (
                availableItems.map((item) => (
                  <DraggableItemCard key={item.id} item={item} />
                ))
              )}
            </div>

            {/* Placed items count */}
            <div className="border-t pt-3 text-sm text-muted-foreground">
              {t("placedItems", { count: unit.placements?.length || 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem && (
          <div className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            {activeItem.type === "item"
              ? activeItem.item?.name
              : activeItem.placement
                ? itemNames.get(activeItem.placement.item_id)
                : "Item"}
          </div>
        )}
      </DragOverlay>
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
}: {
  x: number;
  y: number;
  placement?: GridfinityPlacement;
  isOccupied: boolean;
  itemName?: string;
  onDelete?: () => void;
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
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-12 w-12 rounded border-2 border-dashed transition-colors",
        isOccupied
          ? "border-transparent bg-muted"
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
}: {
  placement: GridfinityPlacement;
  itemName?: string;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placement-${placement.id}`,
    data: { type: "placement", placement } as DraggableItem,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded border-2 border-primary bg-primary/20",
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
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Draggable Item Card Component
function DraggableItemCard({ item }: { item: ItemListItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { type: "item", item } as DraggableItem,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded border p-2 hover:bg-muted/50 active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {item.location && (
          <p className="truncate text-xs text-muted-foreground">
            {item.location.name}
          </p>
        )}
      </div>
    </div>
  );
}
