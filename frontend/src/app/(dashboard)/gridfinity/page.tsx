"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Grid3X3,
  Loader2,
  Trash2,
  Edit,
  ExternalLink,
  Info,
  LayoutGrid,
  LayoutList,
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
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { TreeSelect, TreeNode } from "@/components/ui/tree-view";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  gridfinityApi,
  locationsApi,
  GridfinityUnit,
  GridfinityUnitCreate,
  GridfinityUnitUpdate,
  LocationTreeNode,
} from "@/lib/api/api";
import { formatDate } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StoragePlannerWizard } from "@/components/storage-planner/storage-planner-wizard";
import { useViewMode, VIEW_MODES, type ViewMode } from "@/hooks/use-view-mode";

// Gridfinity unit size constant
const GRID_UNIT_MM = 42;

export default function GridfinityPage() {
  const t = useTranslations("gridfinity");
  const tCommon = useTranslations("common");
  const tStoragePlanner = useTranslations("storagePlanner");
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useViewMode<ViewMode>(
    "gridfinity-view-mode",
    "grid",
    VIEW_MODES
  );

  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<GridfinityUnit | null>(null);
  const [editFormData, setEditFormData] = useState<GridfinityUnitCreate>({
    name: "",
    description: "",
    location_id: null,
    container_width_mm: 252,
    container_depth_mm: 252,
    container_height_mm: 50,
  });

  const { confirm, ConfirmModal } = useConfirmModal();

  // Fetch units
  const { data: units, isLoading } = useQuery({
    queryKey: ["gridfinity", "units"],
    queryFn: () => gridfinityApi.listUnits(),
  });

  // Fetch locations for dropdown
  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  // Update mutation (for editing existing units)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GridfinityUnitUpdate }) =>
      gridfinityApi.updateUnit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gridfinity", "units"] });
      setEditingUnit(null);
      resetEditForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => gridfinityApi.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gridfinity", "units"] });
    },
  });

  const resetEditForm = () => {
    setEditFormData({
      name: "",
      description: "",
      location_id: null,
      container_width_mm: 252,
      container_depth_mm: 252,
      container_height_mm: 50,
    });
  };

  const handleEdit = (unit: GridfinityUnit) => {
    setEditFormData({
      name: unit.name,
      description: unit.description || "",
      location_id: unit.location_id,
      container_width_mm: unit.container_width_mm,
      container_depth_mm: unit.container_depth_mm,
      container_height_mm: unit.container_height_mm,
    });
    setEditingUnit(unit);
  };

  const handleDelete = async (unit: GridfinityUnit) => {
    const confirmed = await confirm({
      title: t("deleteUnit"),
      message: t("deleteUnitConfirm", { name: unit.name }),
      confirmLabel: tCommon("delete"),
      variant: "danger",
    });
    if (confirmed) {
      deleteMutation.mutate(unit.id);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, data: editFormData });
    }
  };

  const calculateGrid = (widthMm: number, depthMm: number) => ({
    columns: Math.floor(widthMm / GRID_UNIT_MM),
    rows: Math.floor(depthMm / GRID_UNIT_MM),
  });

  const editGrid = calculateGrid(
    editFormData.container_width_mm,
    editFormData.container_depth_mm
  );

  // Convert location tree for TreeSelect
  const convertToTreeSelectNodes = (nodes: LocationTreeNode[]): TreeNode[] => {
    return nodes.map((node) => ({
      id: node.id,
      name: node.name,
      children: convertToTreeSelectNodes(node.children ?? []),
    }));
  };

  const locationSelectNodes = locationTree
    ? convertToTreeSelectNodes(locationTree)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
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
                icon: LayoutList,
                label: tCommon("viewMode.list"),
              },
            ]}
          />
          <Button
            onClick={() => setIsCreateWizardOpen(true)}
            data-testid="open-wizard-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            {tStoragePlanner("create")}
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-4">
        <Info className="text-muted-foreground mt-0.5 h-5 w-5" />
        <div className="text-muted-foreground text-sm">
          <p className="text-foreground font-medium">{t("whatIsGridfinity")}</p>
          <p>{t("gridfinityDescription")}</p>
        </div>
      </div>

      {/* Units Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : units && units.length > 0 ? (
        viewMode === "grid" ? (
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-testid="gridfinity-grid-view"
          >
            {units.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border"
            data-testid="gridfinity-list-view"
          >
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                    {tCommon("name")}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap sm:table-cell">
                    {t("gridSize")}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-sm font-medium whitespace-nowrap md:table-cell">
                    {t("location")}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                    {tCommon("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {units.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-muted/50 group transition-colors"
                    data-testid={`gridfinity-unit-row-${unit.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {unit.name}
                        </span>
                        {unit.description && (
                          <span className="text-muted-foreground block truncate text-sm">
                            {unit.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-3 text-sm whitespace-nowrap sm:table-cell">
                      {unit.grid_columns} x {unit.grid_rows} (
                      {unit.grid_columns * unit.grid_rows} {t("cells")})
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-3 text-sm whitespace-nowrap md:table-cell">
                      {unit.container_width_mm} x {unit.container_depth_mm} mm
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(unit)}
                          title={t("editUnit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit)}
                          title={t("deleteUnit")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Link href={`/gridfinity/${unit.id}`}>
                          <Button variant="outline" size="sm">
                            {t("openEditor")}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="py-12 text-center">
          <Grid3X3 className="text-muted-foreground/50 mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">{t("noUnits")}</h3>
          <p className="text-muted-foreground mt-1">{t("createFirst")}</p>
          <Button
            className="mt-4"
            onClick={() => setIsCreateWizardOpen(true)}
            data-testid="empty-state-create-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            {tStoragePlanner("create")}
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingUnit}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUnit(null);
            resetEditForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("editUnit")}</DialogTitle>
            <DialogDescription>{t("editUnitDescription")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{tCommon("name")} *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">{tCommon("description")}</Label>
              <Input
                id="edit-description"
                value={editFormData.description || ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={t("descriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("location")}</Label>
              <TreeSelect
                nodes={locationSelectNodes}
                value={editFormData.location_id}
                onChange={(id) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    location_id: id,
                  }))
                }
                placeholder={t("selectLocation")}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-width">{t("width")} (mm) *</Label>
                <Input
                  id="edit-width"
                  type="number"
                  min={42}
                  value={editFormData.container_width_mm || ""}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    setEditFormData((prev) => ({
                      ...prev,
                      container_width_mm: isNaN(parsed) ? 0 : parsed,
                    }));
                  }}
                  onBlur={(e) => {
                    const parsed = parseInt(e.target.value);
                    if (isNaN(parsed) || parsed < 42) {
                      setEditFormData((prev) => ({
                        ...prev,
                        container_width_mm: 42,
                      }));
                    }
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-depth">{t("depth")} (mm) *</Label>
                <Input
                  id="edit-depth"
                  type="number"
                  min={42}
                  value={editFormData.container_depth_mm || ""}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    setEditFormData((prev) => ({
                      ...prev,
                      container_depth_mm: isNaN(parsed) ? 0 : parsed,
                    }));
                  }}
                  onBlur={(e) => {
                    const parsed = parseInt(e.target.value);
                    if (isNaN(parsed) || parsed < 42) {
                      setEditFormData((prev) => ({
                        ...prev,
                        container_depth_mm: 42,
                      }));
                    }
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-height">{t("height")} (mm) *</Label>
                <Input
                  id="edit-height"
                  type="number"
                  min={7}
                  value={editFormData.container_height_mm || ""}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    setEditFormData((prev) => ({
                      ...prev,
                      container_height_mm: isNaN(parsed) ? 0 : parsed,
                    }));
                  }}
                  onBlur={(e) => {
                    const parsed = parseInt(e.target.value);
                    if (isNaN(parsed) || parsed < 7) {
                      setEditFormData((prev) => ({
                        ...prev,
                        container_height_mm: 7,
                      }));
                    }
                  }}
                  required
                />
              </div>
            </div>

            {/* Grid preview */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-muted-foreground text-sm">
                {t("gridSize")}:{" "}
                <span className="text-foreground font-medium">
                  {editGrid.columns} x {editGrid.rows}
                </span>{" "}
                ({editGrid.columns * editGrid.rows} {t("cells")})
              </div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: Math.min(editGrid.columns, 8) }).map(
                  (_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {Array.from({
                        length: Math.min(editGrid.rows, 8),
                      }).map((_, j) => (
                        <div
                          key={j}
                          className="border-primary/30 bg-primary/20 h-3 w-3 rounded-sm border"
                        />
                      ))}
                    </div>
                  )
                )}
                {editGrid.columns > 8 && (
                  <div className="text-muted-foreground flex items-center text-xs">
                    ...
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingUnit(null);
                  resetEditForm();
                }}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {tCommon("update")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal />

      {/* Storage Planner Create Dialog */}
      <Dialog open={isCreateWizardOpen} onOpenChange={setIsCreateWizardOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tStoragePlanner("createTitle")}</DialogTitle>
            <DialogDescription>
              {tStoragePlanner("createDescription")}
            </DialogDescription>
          </DialogHeader>
          <StoragePlannerWizard
            onComplete={() => setIsCreateWizardOpen(false)}
            onCancel={() => setIsCreateWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Unit Card Component
function UnitCard({
  unit,
  onEdit,
  onDelete,
}: {
  unit: GridfinityUnit;
  onEdit: (unit: GridfinityUnit) => void;
  onDelete: (unit: GridfinityUnit) => void;
}) {
  const t = useTranslations("gridfinity");

  return (
    <div
      className="hover:border-primary/50 rounded-lg border p-4 transition-colors"
      data-testid={`gridfinity-unit-card-${unit.id}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{unit.name}</h3>
          {unit.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {unit.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(unit)}
            title={t("editUnit")}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(unit)}
            title={t("deleteUnit")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid visualization */}
      <div className="mt-4 flex gap-1">
        {Array.from({ length: Math.min(unit.grid_columns, 6) }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: Math.min(unit.grid_rows, 6) }).map((_, j) => (
              <div
                key={j}
                className="border-border bg-muted h-4 w-4 rounded-sm border"
              />
            ))}
          </div>
        ))}
        {unit.grid_columns > 6 && (
          <div className="text-muted-foreground flex items-center text-xs">
            ...
          </div>
        )}
      </div>

      <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
        <span>
          {unit.grid_columns} x {unit.grid_rows} (
          {unit.grid_columns * unit.grid_rows} {t("cells")})
        </span>
        <span>
          {unit.container_width_mm} x {unit.container_depth_mm} mm
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-muted-foreground text-xs">
          {formatDate(unit.created_at)}
        </span>
        <Link href={`/gridfinity/${unit.id}`}>
          <Button variant="outline" size="sm">
            {t("openEditor")}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
