"use client";

import { useTranslations } from "next-intl";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SpecificationEditorProps {
  specifications: Record<string, unknown>;
  onChange: (specifications: Record<string, unknown>) => void;
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

  const entries = Object.entries(specifications);

  // Check if a key is duplicate (case-insensitive)
  const isDuplicateKey = (key: string, currentIndex: number): boolean => {
    if (!key || key.trim() === "") return false;
    const normalizedKey = key.trim().toLowerCase();
    return entries.some(
      ([existingKey], index) =>
        index !== currentIndex &&
        existingKey.trim().toLowerCase() === normalizedKey
    );
  };

  const handleAdd = () => {
    // Add a new empty specification
    const newKey = `spec_${Date.now()}`;
    onChange({ ...specifications, [newKey]: "" });
  };

  const handleRemove = (index: number) => {
    const newEntries = entries.filter((_, i) => i !== index);
    const newSpecs = Object.fromEntries(newEntries);
    onChange(newSpecs);
  };

  const handleKeyChange = (index: number, newKey: string) => {
    const newEntries = [...entries];
    newEntries[index] = [newKey, newEntries[index][1]];
    const newSpecs = Object.fromEntries(newEntries);
    onChange(newSpecs);
  };

  const handleValueChange = (index: number, value: string) => {
    // Try to parse as number or boolean if possible
    let parsedValue: unknown = value;

    if (value === "true") {
      parsedValue = true;
    } else if (value === "false") {
      parsedValue = false;
    } else if (value !== "" && !isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    const newEntries = [...entries];
    newEntries[index] = [newEntries[index][0], parsedValue];
    const newSpecs = Object.fromEntries(newEntries);
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

    const newEntries = [...entries];
    const [draggedEntry] = newEntries.splice(draggedIndex, 1);
    newEntries.splice(dropIndex, 0, draggedEntry);

    const newSpecs = Object.fromEntries(newEntries);
    onChange(newSpecs);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getDisplayValue = (value: unknown): string => {
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

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noSpecifications")}</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value], index) => {
            const hasDuplicate = isDuplicateKey(key, index);
            const isDragging = draggedIndex === index;
            const isDropTarget = dragOverIndex === index;

            return (
              <div key={index} className="space-y-1">
                <div
                  className={cn(
                    "flex gap-2 rounded-lg transition-all",
                    isDragging && "opacity-50",
                    isDropTarget && "ring-primary bg-primary/5 ring-2"
                  )}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
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
                    value={key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    placeholder={t("specificationKey")}
                    className={cn(
                      "bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden",
                      hasDuplicate &&
                        "border-destructive focus:ring-destructive/20"
                    )}
                    data-testid={`specification-key-${index}`}
                  />
                  <input
                    type="text"
                    value={getDisplayValue(value)}
                    onChange={(e) => handleValueChange(index, e.target.value)}
                    placeholder={t("specificationValue")}
                    className="bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                    data-testid={`specification-value-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    className="text-muted-foreground hover:text-destructive h-10 w-10 shrink-0"
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
