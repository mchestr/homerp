"use client";

import { useTranslations } from "next-intl";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Specification as array item with key and value
export interface Specification {
  key: string;
  value: string | number | boolean;
}

interface SpecificationEditorProps {
  specifications: Specification[];
  onChange: (specifications: Specification[]) => void;
  className?: string;
}

export function SpecificationEditor({
  specifications,
  onChange,
  className,
}: SpecificationEditorProps) {
  const t = useTranslations("items");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Check if a key is duplicate (case-insensitive)
  const isDuplicateKey = (key: string, currentIndex: number): boolean => {
    if (!key || key.trim() === "") return false;
    const normalizedKey = key.trim().toLowerCase();
    return specifications.some(
      (spec, index) =>
        index !== currentIndex &&
        spec.key.trim().toLowerCase() === normalizedKey
    );
  };

  const handleAdd = () => {
    // Add a new empty specification
    onChange([...specifications, { key: "", value: "" }]);
  };

  const handleRemove = (index: number) => {
    const newSpecs = specifications.filter((_, i) => i !== index);
    onChange(newSpecs);
  };

  const handleKeyChange = (index: number, newKey: string) => {
    const newSpecs = [...specifications];
    newSpecs[index] = { ...newSpecs[index], key: newKey };
    onChange(newSpecs);
  };

  const handleValueChange = (index: number, value: string) => {
    // Try to parse as number or boolean if possible
    let parsedValue: string | number | boolean = value;

    if (value === "true") {
      parsedValue = true;
    } else if (value === "false") {
      parsedValue = false;
    } else if (value !== "" && !isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    const newSpecs = [...specifications];
    newSpecs[index] = { ...newSpecs[index], value: parsedValue };
    onChange(newSpecs);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSpecs = [...specifications];
    const [draggedSpec] = newSpecs.splice(draggedIndex, 1);
    newSpecs.splice(dropIndex, 0, draggedSpec);

    onChange(newSpecs);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getDisplayValue = (value: string | number | boolean): string => {
    if (typeof value === "boolean") {
      return value.toString();
    }
    if (typeof value === "number") {
      return value.toString();
    }
    return String(value ?? "");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-medium">
          {t("specifications")}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          data-testid="add-specification-button"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addSpecification")}
        </Button>
      </div>

      {specifications.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noSpecifications")}</p>
      ) : (
        <div className="space-y-3">
          {specifications.map((spec, index) => {
            const hasDuplicate = isDuplicateKey(spec.key, index);
            const isDragging = draggedIndex === index;
            const isDropTarget = dragOverIndex === index;

            return (
              <div key={index} className="space-y-1">
                <div
                  className={cn(
                    "flex min-w-0 gap-2 rounded-lg transition-all",
                    isDragging && "opacity-50",
                    isDropTarget && "ring-primary bg-primary/5 ring-2"
                  )}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onMouseDown={(e) => {
                    // Prevent drag from starting on interactive elements
                    const target = e.target as HTMLElement;
                    if (
                      target.tagName === "INPUT" ||
                      target.tagName === "BUTTON" ||
                      target.closest("button")
                    ) {
                      e.stopPropagation();
                    }
                  }}
                  data-testid={`specification-row-${index}`}
                >
                  <div
                    className="text-muted-foreground hover:text-foreground flex h-10 w-8 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                    data-testid={`drag-handle-${index}`}
                    title={t("dragToReorder")}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={spec.key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    placeholder={t("specificationKey")}
                    className={cn(
                      "bg-background focus:border-primary focus:ring-primary/20 h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden",
                      hasDuplicate &&
                        "border-destructive focus:ring-destructive/20"
                    )}
                    data-testid={`specification-key-${index}`}
                  />
                  <input
                    type="text"
                    value={getDisplayValue(spec.value)}
                    onChange={(e) => handleValueChange(index, e.target.value)}
                    placeholder={t("specificationValue")}
                    className="bg-background focus:border-primary focus:ring-primary/20 h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                    data-testid={`specification-value-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    className="text-muted-foreground hover:text-destructive relative z-50 h-10 w-10 shrink-0"
                    data-testid={`remove-specification-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {hasDuplicate && (
                  <p
                    className="text-destructive ml-10 text-xs"
                    data-testid={`duplicate-key-error-${index}`}
                  >
                    {t("duplicateKeyError")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
