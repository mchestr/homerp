"use client";

import { useTranslations } from "next-intl";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const entries = Object.entries(specifications);

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

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newEntries = [...entries];
    [newEntries[index - 1], newEntries[index]] = [
      newEntries[index],
      newEntries[index - 1],
    ];
    const newSpecs = Object.fromEntries(newEntries);
    onChange(newSpecs);
  };

  const handleMoveDown = (index: number) => {
    if (index === entries.length - 1) return;
    const newEntries = [...entries];
    [newEntries[index], newEntries[index + 1]] = [
      newEntries[index + 1],
      newEntries[index],
    ];
    const newSpecs = Object.fromEntries(newEntries);
    onChange(newSpecs);
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
          {entries.map(([key, value], index) => (
            <div key={index} className="flex gap-2">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground h-4 w-8 shrink-0 disabled:opacity-30"
                  data-testid={`move-up-specification-${index}`}
                  title={t("moveUp")}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === entries.length - 1}
                  className="text-muted-foreground hover:text-foreground h-4 w-8 shrink-0 disabled:opacity-30"
                  data-testid={`move-down-specification-${index}`}
                  title={t("moveDown")}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <input
                type="text"
                value={key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                placeholder={t("specificationKey")}
                className="bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
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
          ))}
        </div>
      )}
    </div>
  );
}
