"use client";

import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
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

  const handleRemove = (key: string) => {
    const newSpecs = { ...specifications };
    delete newSpecs[key];
    onChange(newSpecs);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;

    // Create new object with updated key
    const newSpecs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(specifications)) {
      if (k === oldKey) {
        newSpecs[newKey] = v;
      } else {
        newSpecs[k] = v;
      }
    }
    onChange(newSpecs);
  };

  const handleValueChange = (key: string, value: string) => {
    // Try to parse as number or boolean if possible
    let parsedValue: unknown = value;

    if (value === "true") {
      parsedValue = true;
    } else if (value === "false") {
      parsedValue = false;
    } else if (value !== "" && !isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    onChange({ ...specifications, [key]: parsedValue });
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
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => handleKeyChange(key, e.target.value)}
                placeholder={t("specificationKey")}
                className="bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                data-testid={`specification-key-${key}`}
              />
              <input
                type="text"
                value={getDisplayValue(value)}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder={t("specificationValue")}
                className="bg-background focus:border-primary focus:ring-primary/20 h-10 flex-1 rounded-lg border px-3 text-sm transition-colors focus:ring-2 focus:outline-hidden"
                data-testid={`specification-value-${key}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(key)}
                className="text-muted-foreground hover:text-destructive h-10 w-10 shrink-0"
                data-testid={`remove-specification-${key}`}
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
