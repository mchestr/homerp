"use client";

import { useTranslations } from "next-intl";

// Specification as array item with key and value
interface Specification {
  key: string;
  value: string | number | boolean;
}

type SpecificationTagsProps = {
  attributes: Record<string, unknown> | undefined | null;
  maxCount?: number;
  className?: string;
  emptyFallback?: React.ReactNode;
};

/**
 * Displays item specifications as compact tags.
 * Extracts specifications from the nested attributes.specifications structure.
 * Supports both new array format and legacy dict format.
 */
export function SpecificationTags({
  attributes,
  maxCount = 3,
  className = "",
  emptyFallback = null,
}: SpecificationTagsProps) {
  const t = useTranslations("items");

  if (!attributes || typeof attributes !== "object") return emptyFallback;

  const specs = (attributes as Record<string, unknown>)["specifications"];
  if (!specs) return emptyFallback;

  // Convert to array of Specification objects
  let specArray: Specification[] = [];

  if (Array.isArray(specs)) {
    // New array format: [{key: "color", value: "red"}, ...]
    specArray = specs.filter(
      (s): s is Specification =>
        typeof s === "object" &&
        s !== null &&
        "key" in s &&
        "value" in s &&
        typeof s.key === "string"
    );
  } else if (typeof specs === "object" && specs !== null) {
    // Legacy dict format: {color: "red", ...}
    specArray = Object.entries(specs as Record<string, unknown>).map(
      ([key, value]) => ({
        key,
        value:
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
            ? value
            : String(value),
      })
    );
  }

  if (specArray.length === 0) return emptyFallback;

  const visibleSpecs = specArray.slice(0, maxCount);
  const hiddenCount = specArray.length - visibleSpecs.length;

  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`}
      data-testid="specification-tags"
    >
      {visibleSpecs.map((spec) => (
        <span
          key={spec.key}
          className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-xs"
          title={`${spec.key.replace(/_/g, " ")}: ${String(spec.value)}`}
          data-testid={`spec-tag-${spec.key}`}
        >
          <span className="max-w-[60px] truncate capitalize">
            {spec.key.replace(/_/g, " ")}
          </span>
          :{" "}
          <span className="ml-0.5 max-w-[50px] truncate font-medium">
            {String(spec.value)}
          </span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          className="bg-muted/50 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-xs"
          title={t("moreSpecifications", { count: hiddenCount })}
          data-testid="spec-tag-more"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
