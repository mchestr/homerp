"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Grid3X3,
  LayoutGrid,
  Package,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TreeSelect, TreeNode } from "@/components/ui/tree-view";
import {
  gridfinityApi,
  locationsApi,
  GridfinityUnitCreate,
  LocationTreeNode,
} from "@/lib/api/api-client";
import { cn } from "@/lib/utils";

// Storage type definitions
export type StorageType = "gridfinity" | "multiboard" | "toteRack";

interface StorageTypeOption {
  id: StorageType;
  icon: React.ReactNode;
  features: string[];
  isComingSoon?: boolean;
}

// Wizard step definitions
type WizardStep = "type-selection" | "configuration" | "review";

const STEPS: WizardStep[] = ["type-selection", "configuration", "review"];

// Grid unit size constants
const GRID_UNIT_MM = 42;

interface StoragePlannerWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function StoragePlannerWizard({
  onComplete,
  onCancel,
}: StoragePlannerWizardProps) {
  const t = useTranslations("storagePlanner");
  const tCommon = useTranslations("common");
  const tGridfinity = useTranslations("gridfinity");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("type-selection");
  const [selectedType, setSelectedType] = useState<StorageType | null>(null);

  // Form data for different storage types
  const [gridfinityData, setGridfinityData] = useState<GridfinityUnitCreate>({
    name: "",
    description: "",
    location_id: null,
    container_width_mm: 252,
    container_depth_mm: 252,
    container_height_mm: 50,
  });

  // Fetch locations for dropdown
  const { data: locationTree } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: () => locationsApi.tree(),
  });

  // Create Gridfinity unit mutation
  const createGridfinityMutation = useMutation({
    mutationFn: (data: GridfinityUnitCreate) => gridfinityApi.createUnit(data),
    onSuccess: async (unit) => {
      await queryClient.invalidateQueries({
        queryKey: ["gridfinity", "units"],
      });
      // Navigate first, then close dialog to avoid race condition
      router.push(`/gridfinity/${unit.id}`);
      onComplete();
    },
  });

  // Storage type options
  const storageTypes: StorageTypeOption[] = [
    {
      id: "gridfinity",
      icon: <Grid3X3 className="h-8 w-8" />,
      features: [
        t("gridfinity.feature1"),
        t("gridfinity.feature2"),
        t("gridfinity.feature3"),
      ],
    },
    {
      id: "multiboard",
      icon: <LayoutGrid className="h-8 w-8" />,
      features: [
        t("multiboard.feature1"),
        t("multiboard.feature2"),
        t("multiboard.feature3"),
      ],
      isComingSoon: true,
    },
    {
      id: "toteRack",
      icon: <Package className="h-8 w-8" />,
      features: [
        t("toteRack.feature1"),
        t("toteRack.feature2"),
        t("toteRack.feature3"),
      ],
      isComingSoon: true,
    },
  ];

  // Convert location tree for TreeSelect
  const convertToTreeSelectNodes = (nodes: LocationTreeNode[]): TreeNode[] => {
    return nodes.map((node) => ({
      id: node.id,
      name: node.name,
      children: convertToTreeSelectNodes(node.children),
    }));
  };

  const locationSelectNodes = locationTree
    ? convertToTreeSelectNodes(locationTree)
    : [];

  // Navigation
  const currentStepIndex = STEPS.indexOf(currentStep);
  const progressValue = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "type-selection":
        return selectedType !== null;
      case "configuration":
        if (selectedType === "gridfinity") {
          return gridfinityData.name.trim() !== "";
        }
        // Multiboard and toteRack are coming soon, so they always pass
        // configuration step (we show coming soon message instead)
        if (selectedType === "multiboard" || selectedType === "toteRack") {
          return true;
        }
        return false;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const handleCreate = () => {
    if (selectedType === "gridfinity") {
      createGridfinityMutation.mutate(gridfinityData);
    }
    // For now, multiboard and toteRack are coming soon
    // TODO: Implement when backend support is added
  };

  // Calculate grid size for preview
  const calculateGrid = (widthMm: number, depthMm: number) => ({
    columns: Math.floor(widthMm / GRID_UNIT_MM),
    rows: Math.floor(depthMm / GRID_UNIT_MM),
  });

  const gridfinityGrid = calculateGrid(
    gridfinityData.container_width_mm,
    gridfinityData.container_depth_mm
  );

  const isCreating = createGridfinityMutation.isPending;

  return (
    <div
      className="flex flex-col space-y-6"
      data-testid="storage-planner-wizard"
    >
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {t("step", {
              current: currentStepIndex + 1,
              total: STEPS.length,
            })}
          </span>
          <span className="text-muted-foreground">
            {t(`steps.${currentStep}`)}
          </span>
        </div>
        <Progress value={progressValue} />
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {/* Step 1: Type Selection */}
        {currentStep === "type-selection" && (
          <div className="space-y-6" data-testid="step-type-selection">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{t("selectType.title")}</h2>
              <p className="text-muted-foreground">
                {t("selectType.description")}
              </p>
              <p className="text-muted-foreground/80 text-sm">
                {t("selectType.helpText")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {storageTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => !type.isComingSoon && setSelectedType(type.id)}
                  disabled={type.isComingSoon}
                  data-testid={`storage-type-${type.id}`}
                  className={cn(
                    "group relative flex flex-col rounded-xl border-2 p-6 text-left transition-all",
                    type.isComingSoon
                      ? "border-border cursor-not-allowed opacity-60"
                      : selectedType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Selected indicator */}
                  {selectedType === type.id && (
                    <div className="absolute top-3 right-3">
                      <div className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "mb-4 flex h-14 w-14 items-center justify-center rounded-lg transition-colors",
                      selectedType === type.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}
                  >
                    {type.icon}
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 font-semibold">
                    {t(`${type.id}.title`)}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground mb-4 text-sm">
                    {t(`${type.id}.description`)}
                  </p>

                  {/* Features */}
                  <ul className="mt-auto space-y-1">
                    {type.features.map((feature, index) => (
                      <li
                        key={index}
                        className="text-muted-foreground flex items-start gap-2 text-xs"
                      >
                        <Check className="text-primary mt-0.5 h-3 w-3 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Coming soon badge */}
                  {type.isComingSoon && (
                    <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <Info className="h-3 w-3" />
                      {t("comingSoon")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {currentStep === "configuration" && (
          <div className="space-y-6" data-testid="step-configuration">
            <div>
              <h2 className="text-lg font-semibold">
                {t("configuration.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("configuration.description", {
                  type: t(`${selectedType}.title`),
                })}
              </p>
            </div>

            {/* Gridfinity Configuration */}
            {selectedType === "gridfinity" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{tCommon("name")} *</Label>
                    <Input
                      id="name"
                      value={gridfinityData.name}
                      onChange={(e) =>
                        setGridfinityData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder={tGridfinity("namePlaceholder")}
                      required
                      data-testid="gridfinity-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      {tCommon("description")}
                    </Label>
                    <Input
                      id="description"
                      value={gridfinityData.description || ""}
                      onChange={(e) =>
                        setGridfinityData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder={tGridfinity("descriptionPlaceholder")}
                      data-testid="gridfinity-description-input"
                    />
                  </div>
                </div>

                <div
                  className="space-y-2"
                  data-testid="gridfinity-location-select"
                >
                  <Label>{tGridfinity("location")}</Label>
                  <TreeSelect
                    nodes={locationSelectNodes}
                    value={gridfinityData.location_id}
                    onChange={(id) =>
                      setGridfinityData((prev) => ({
                        ...prev,
                        location_id: id,
                      }))
                    }
                    placeholder={tGridfinity("selectLocation")}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">{tGridfinity("width")} (mm) *</Label>
                    <Input
                      id="width"
                      type="number"
                      min={42}
                      value={gridfinityData.container_width_mm || ""}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        setGridfinityData((prev) => ({
                          ...prev,
                          container_width_mm: isNaN(parsed) ? 0 : parsed,
                        }));
                      }}
                      onBlur={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (isNaN(parsed) || parsed < 42) {
                          setGridfinityData((prev) => ({
                            ...prev,
                            container_width_mm: 42,
                          }));
                        }
                      }}
                      required
                      data-testid="gridfinity-width-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depth">{tGridfinity("depth")} (mm) *</Label>
                    <Input
                      id="depth"
                      type="number"
                      min={42}
                      value={gridfinityData.container_depth_mm || ""}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        setGridfinityData((prev) => ({
                          ...prev,
                          container_depth_mm: isNaN(parsed) ? 0 : parsed,
                        }));
                      }}
                      onBlur={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (isNaN(parsed) || parsed < 42) {
                          setGridfinityData((prev) => ({
                            ...prev,
                            container_depth_mm: 42,
                          }));
                        }
                      }}
                      required
                      data-testid="gridfinity-depth-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">
                      {tGridfinity("height")} (mm) *
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      min={7}
                      value={gridfinityData.container_height_mm || ""}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        setGridfinityData((prev) => ({
                          ...prev,
                          container_height_mm: isNaN(parsed) ? 0 : parsed,
                        }));
                      }}
                      onBlur={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (isNaN(parsed) || parsed < 7) {
                          setGridfinityData((prev) => ({
                            ...prev,
                            container_height_mm: 7,
                          }));
                        }
                      }}
                      required
                      data-testid="gridfinity-height-input"
                    />
                  </div>
                </div>

                {/* Grid preview */}
                <div
                  className="bg-muted/50 rounded-lg p-4"
                  data-testid="gridfinity-grid-preview"
                >
                  <div className="text-muted-foreground text-sm">
                    {tGridfinity("gridSize")}:{" "}
                    <span className="text-foreground font-medium">
                      {gridfinityGrid.columns} x {gridfinityGrid.rows}
                    </span>{" "}
                    ({gridfinityGrid.columns * gridfinityGrid.rows}{" "}
                    {tGridfinity("cells")})
                  </div>
                  <div className="mt-3 flex gap-1">
                    {Array.from({
                      length: Math.min(gridfinityGrid.columns, 8),
                    }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        {Array.from({
                          length: Math.min(gridfinityGrid.rows, 8),
                        }).map((_, j) => (
                          <div
                            key={j}
                            className="border-primary/30 bg-primary/20 h-4 w-4 rounded-sm border"
                          />
                        ))}
                      </div>
                    ))}
                    {gridfinityGrid.columns > 8 && (
                      <div className="text-muted-foreground flex items-center text-xs">
                        ...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Multiboard Configuration (Coming Soon) */}
            {selectedType === "multiboard" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Info className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {t("multiboard.comingSoonTitle")}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {t("multiboard.comingSoonDescription")}
                </p>
              </div>
            )}

            {/* Tote Rack Configuration (Coming Soon) */}
            {selectedType === "toteRack" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Info className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {t("toteRack.comingSoonTitle")}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {t("toteRack.comingSoonDescription")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === "review" && (
          <div className="space-y-6" data-testid="step-review">
            <div>
              <h2 className="text-lg font-semibold">{t("review.title")}</h2>
              <p className="text-muted-foreground">{t("review.description")}</p>
            </div>

            {selectedType === "gridfinity" && (
              <div className="bg-card rounded-xl border p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                    <Grid3X3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{gridfinityData.name}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t("gridfinity.title")}
                    </p>
                  </div>
                </div>

                <dl className="grid gap-4 md:grid-cols-2">
                  {gridfinityData.description && (
                    <div className="md:col-span-2">
                      <dt className="text-muted-foreground text-sm font-medium">
                        {tCommon("description")}
                      </dt>
                      <dd className="mt-1">{gridfinityData.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      {t("review.dimensions")}
                    </dt>
                    <dd className="mt-1">
                      {gridfinityData.container_width_mm} x{" "}
                      {gridfinityData.container_depth_mm} x{" "}
                      {gridfinityData.container_height_mm} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      {tGridfinity("gridSize")}
                    </dt>
                    <dd className="mt-1">
                      {gridfinityGrid.columns} x {gridfinityGrid.rows} (
                      {gridfinityGrid.columns * gridfinityGrid.rows}{" "}
                      {tGridfinity("cells")})
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {(selectedType === "multiboard" || selectedType === "toteRack") && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Info className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {t("review.comingSoon")}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {t("review.comingSoonDescription")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={currentStepIndex === 0 ? onCancel : handleBack}
          disabled={isCreating}
          data-testid="wizard-back-button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {currentStepIndex === 0 ? tCommon("cancel") : t("back")}
        </Button>

        <div className="flex gap-2">
          {currentStep === "review" ? (
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                !canProceed() ||
                isCreating ||
                selectedType === "multiboard" ||
                selectedType === "toteRack"
              }
              data-testid="wizard-create-button"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" />
              {t("create")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              data-testid="wizard-next-button"
            >
              {t("next")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
