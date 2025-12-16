"use client";

import { useEffect } from "react";
import type { AttributeField } from "@/lib/api/api-client";
import { cn } from "@/lib/utils";

interface DynamicAttributeFormProps {
  fields: AttributeField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  className?: string;
}

export function DynamicAttributeForm({
  fields,
  values,
  onChange,
  className,
}: DynamicAttributeFormProps) {
  // Initialize default values
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    let hasDefaults = false;

    for (const field of fields) {
      if (field.default !== undefined && values[field.name] === undefined) {
        defaults[field.name] = field.default;
        hasDefaults = true;
      }
    }

    if (hasDefaults) {
      onChange({ ...values, ...defaults });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const handleChange = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-muted-foreground text-sm font-medium">
        Category Attributes
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => handleChange(field.name, value)}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldRendererProps {
  field: AttributeField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const inputClasses =
    "h-11 w-full rounded-lg border bg-background px-4 text-base transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20";

  const labelClasses = "mb-1.5 block text-sm font-medium";

  switch (field.type) {
    case "text":
      return (
        <div>
          <label className={labelClasses}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              required={field.required}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className={cn(inputClasses, field.unit && "pr-12")}
            />
            {field.unit && (
              <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      );

    case "number":
      return (
        <div>
          <label className={labelClasses}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <div className="relative">
            <input
              type="number"
              value={(value as number) ?? ""}
              onChange={(e) =>
                onChange(e.target.value ? Number(e.target.value) : undefined)
              }
              required={field.required}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className={cn(inputClasses, field.unit && "pr-12")}
            />
            {field.unit && (
              <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      );

    case "select":
      return (
        <div>
          <label className={labelClasses}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            required={field.required}
            className={inputClasses}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-3 pt-6">
          <input
            type="checkbox"
            id={`attr-${field.name}`}
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="text-primary focus:ring-primary h-5 w-5 rounded border-gray-300"
          />
          <label htmlFor={`attr-${field.name}`} className="text-sm font-medium">
            {field.label}
          </label>
        </div>
      );

    default:
      return null;
  }
}

// Attribute template editor for category forms
interface AttributeTemplateEditorProps {
  fields: AttributeField[];
  onChange: (fields: AttributeField[]) => void;
  className?: string;
}

export function AttributeTemplateEditor({
  fields,
  onChange,
  className,
}: AttributeTemplateEditorProps) {
  const addField = () => {
    onChange([
      ...fields,
      {
        name: "",
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<AttributeField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [
      newFields[newIndex],
      newFields[index],
    ];
    onChange(newFields);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Attribute Template</h3>
        <button
          type="button"
          onClick={addField}
          className="text-primary text-sm hover:underline"
        >
          + Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No attribute fields defined. Items in this category will only have
          standard fields.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="bg-card space-y-3 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      const name = label
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "");
                      updateField(index, { label, name });
                    }}
                    placeholder="Field label"
                    className="bg-background h-9 rounded border px-3 text-sm"
                  />
                  <select
                    value={field.type}
                    onChange={(e) =>
                      updateField(index, {
                        type: e.target.value as AttributeField["type"],
                        options: e.target.value === "select" ? [""] : undefined,
                      })
                    }
                    className="bg-background h-9 rounded border px-3 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="boolean">Checkbox</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(index, "up")}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, "down")}
                    disabled={index === fields.length - 1}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required ?? false}
                    onChange={(e) =>
                      updateField(index, { required: e.target.checked })
                    }
                    className="rounded"
                  />
                  Required
                </label>

                {field.type === "number" && (
                  <input
                    type="text"
                    value={field.unit ?? ""}
                    onChange={(e) =>
                      updateField(index, { unit: e.target.value || undefined })
                    }
                    placeholder="Unit (e.g., mm, kg)"
                    className="bg-background h-8 w-28 rounded border px-2 text-sm"
                  />
                )}
              </div>

              {field.type === "select" && (
                <div>
                  <label className="text-muted-foreground text-xs">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={field.options?.join(", ") ?? ""}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Option 1, Option 2, Option 3"
                    className="bg-background mt-1 h-9 w-full rounded border px-3 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
