"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LocationAnalysisResult,
  LocationSuggestion,
  LocationCreate,
} from "@/lib/api/api-client";
import { cn } from "@/lib/utils";

const LOCATION_TYPES = [
  { value: "room", label: "Room", icon: "🏠" },
  { value: "shelf", label: "Shelf", icon: "📚" },
  { value: "bin", label: "Bin", icon: "🗑️" },
  { value: "drawer", label: "Drawer", icon: "🗄️" },
  { value: "box", label: "Box", icon: "📦" },
  { value: "cabinet", label: "Cabinet", icon: "🚪" },
];

type EditableSuggestion = LocationSuggestion & { id: string };

type LocationSuggestionPreviewProps = {
  result: LocationAnalysisResult;
  onConfirm: (parent: LocationCreate, children: LocationCreate[]) => void;
  onCancel: () => void;
  isCreating?: boolean;
  existingParentId?: string;
};

export function LocationSuggestionPreview({
  result,
  onConfirm,
  onCancel,
  isCreating = false,
  existingParentId,
}: LocationSuggestionPreviewProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [parent, setParent] = useState<EditableSuggestion>({
    ...result.parent,
    id: "parent",
  });
  const [children, setChildren] = useState<EditableSuggestion[]>(
    result.children.map((child, index) => ({
      ...child,
      id: `child-${index}`,
    }))
  );

  const getTypeIcon = (type: string) => {
    return LOCATION_TYPES.find((t) => t.value === type)?.icon || "📍";
  };

  const handleParentChange = (
    field: keyof LocationSuggestion,
    value: string
  ) => {
    setParent((prev) => ({ ...prev, [field]: value }));
  };

  const handleChildChange = (
    id: string,
    field: keyof LocationSuggestion,
    value: string
  ) => {
    setChildren((prev) =>
      prev.map((child) =>
        child.id === id ? { ...child, [field]: value } : child
      )
    );
  };

  const handleRemoveChild = (id: string) => {
    setChildren((prev) => prev.filter((child) => child.id !== id));
  };

  const handleAddChild = () => {
    const newId = `child-${Date.now()}`;
    setChildren((prev) => [
      ...prev,
      {
        id: newId,
        name: `Compartment ${prev.length + 1}`,
        location_type: "bin",
        description: null,
      },
    ]);
  };

  const handleConfirm = () => {
    const parentCreate: LocationCreate = {
      name: parent.name,
      location_type: parent.location_type,
      description: parent.description || undefined,
      parent_id: existingParentId,
    };

    const childrenCreate: LocationCreate[] = children.map((child) => ({
      name: child.name,
      location_type: child.location_type,
      description: child.description || undefined,
    }));

    onConfirm(parentCreate, childrenCreate);
  };

  const confidencePercent = Math.round(result.confidence * 100);
  const confidenceColor =
    confidencePercent >= 80
      ? "bg-emerald-500"
      : confidencePercent >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-6 rounded-xl border border-violet-200 bg-violet-50/50 p-6 dark:border-violet-800 dark:bg-violet-950/30">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/50">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-violet-900 dark:text-violet-100">
              AI Suggestions
            </h3>
            <p className="text-sm text-violet-600 dark:text-violet-400">
              Review and edit the suggested locations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-800">
              <div
                className={cn("h-full rounded-full", confidenceColor)}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-sm font-medium">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      {/* Reasoning (collapsible) */}
      {result.reasoning && (
        <button
          type="button"
          onClick={() => setShowReasoning(!showReasoning)}
          className="flex w-full items-center gap-2 text-sm text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
        >
          {showReasoning ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {showReasoning ? "Hide reasoning" : "Show AI reasoning"}
        </button>
      )}
      {showReasoning && result.reasoning && (
        <div className="rounded-lg bg-white/60 p-4 text-sm text-muted-foreground dark:bg-black/20">
          {result.reasoning}
        </div>
      )}

      {/* Parent Location */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-900 dark:text-violet-100">
            Main Container
          </span>
        </div>
        <div className="rounded-lg bg-white/80 p-4 dark:bg-black/30">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Name
              </label>
              <input
                type="text"
                value={parent.name}
                onChange={(e) => handleParentChange("name", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Type
              </label>
              <select
                value={parent.location_type}
                onChange={(e) =>
                  handleParentChange("location_type", e.target.value)
                }
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {LOCATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <input
                type="text"
                value={parent.description || ""}
                onChange={(e) =>
                  handleParentChange("description", e.target.value)
                }
                placeholder="Optional"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Children Locations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-violet-900 dark:text-violet-100">
              Compartments ({children.length})
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddChild}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {children.length === 0 ? (
          <div className="rounded-lg bg-white/60 p-4 text-center text-sm text-muted-foreground dark:bg-black/20">
            No compartments identified. Click &quot;Add&quot; to add one
            manually.
          </div>
        ) : (
          <div className="space-y-2">
            {children.map((child, index) => (
              <div
                key={child.id}
                className="group rounded-lg bg-white/60 p-3 dark:bg-black/20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm dark:bg-violet-900/50">
                    {getTypeIcon(child.location_type)}
                  </div>
                  <div className="grid flex-1 gap-3 md:grid-cols-3">
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) =>
                        handleChildChange(child.id, "name", e.target.value)
                      }
                      placeholder={`Compartment ${index + 1}`}
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={child.location_type}
                      onChange={(e) =>
                        handleChildChange(
                          child.id,
                          "location_type",
                          e.target.value
                        )
                      }
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {LOCATION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={child.description || ""}
                      onChange={(e) =>
                        handleChildChange(
                          child.id,
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="Description (optional)"
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveChild(child.id)}
                    className="rounded-lg p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-violet-200 pt-5 dark:border-violet-800 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={isCreating || !parent.name.trim()}
          className="w-full gap-2 sm:w-auto"
        >
          {isCreating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create {1 + children.length} Location
              {children.length !== 0 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
