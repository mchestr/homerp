"use client";

import { useTranslations } from "next-intl";

type SpecificationTagsProps = {
  attributes: Record<string, unknown> | undefined | null;
  maxCount?: number;
  className?: string;
  emptyFallback?: React.ReactNode;
};

/**
 * Displays item specifications as compact tags.
 * Extracts specifications from the nested attributes.specifications structure.
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
  if (!specs || typeof specs !== "object") return emptyFallback;

  const allEntries = Object.entries(specs as Record<string, unknown>);
  if (allEntries.length === 0) return emptyFallback;

  const visibleEntries = allEntries.slice(0, maxCount);
  const hiddenCount = allEntries.length - visibleEntries.length;

  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`}
      data-testid="specification-tags"
    >
      {visibleEntries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
          title={`${key.replace(/_/g, " ")}: ${String(value)}`}
          data-testid={`spec-tag-${key}`}
        >
          <span className="max-w-[60px] truncate capitalize">
            {key.replace(/_/g, " ")}
          </span>
          :{" "}
          <span className="ml-0.5 max-w-[50px] truncate font-medium">
            {String(value)}
          </span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
          title={t("moreSpecifications", { count: hiddenCount })}
          data-testid="spec-tag-more"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
