"use client";

import { useState } from "react";
import { ChevronDown, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Facet, FacetValue } from "@/lib/api/client";

interface FacetedFilterProps {
  facets: Facet[];
  selectedFilters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
  availableTags?: FacetValue[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function FacetedFilter({
  facets,
  selectedFilters,
  onFilterChange,
  availableTags = [],
  selectedTags,
  onTagsChange,
  className,
}: FacetedFilterProps) {
  const [expandedFacets, setExpandedFacets] = useState<Record<string, boolean>>(
    {}
  );

  const toggleFacet = (name: string) => {
    setExpandedFacets((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFilterSelect = (facetName: string, value: string) => {
    if (selectedFilters[facetName] === value) {
      // Deselect if already selected
      const newFilters = { ...selectedFilters };
      delete newFilters[facetName];
      onFilterChange(newFilters);
    } else {
      onFilterChange({ ...selectedFilters, [facetName]: value });
    }
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAllFilters = () => {
    onFilterChange({});
    onTagsChange([]);
  };

  const hasActiveFilters =
    Object.keys(selectedFilters).length > 0 || selectedTags.length > 0;

  if (facets.length === 0 && availableTags.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(selectedFilters).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {key}: {value}
              <button
                type="button"
                onClick={() => handleFilterSelect(key, value)}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleTagToggle(tag)}
                className="rounded-full p-0.5 hover:bg-blue-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tags section */}
      {availableTags.length > 0 && (
        <div className="border-b pb-3">
          <button
            type="button"
            onClick={() => toggleFacet("_tags")}
            className="flex w-full items-center justify-between py-2 text-sm font-medium"
          >
            Tags
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expandedFacets["_tags"] && "rotate-180"
              )}
            />
          </button>
          {expandedFacets["_tags"] && (
            <div className="mt-2 space-y-1">
              {availableTags.slice(0, 15).map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => handleTagToggle(tag.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
                    selectedTags.includes(tag.value)
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "hover:bg-muted"
                  )}
                >
                  <span>#{tag.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attribute facets */}
      {facets.map((facet) => (
        <div key={facet.name} className="border-b pb-3 last:border-0">
          <button
            type="button"
            onClick={() => toggleFacet(facet.name)}
            className="flex w-full items-center justify-between py-2 text-sm font-medium"
          >
            {facet.label}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expandedFacets[facet.name] && "rotate-180"
              )}
            />
          </button>
          {expandedFacets[facet.name] && (
            <div className="mt-2 space-y-1">
              {facet.values.map((fv) => (
                <button
                  key={fv.value}
                  type="button"
                  onClick={() => handleFilterSelect(facet.name, fv.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
                    selectedFilters[facet.name] === fv.value
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="truncate">{fv.value}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {fv.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Compact inline facets for mobile/smaller views
interface InlineFacetedFilterProps {
  facets: Facet[];
  selectedFilters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function InlineFacetedFilter({
  facets,
  selectedFilters,
  onFilterChange,
  selectedTags,
  onTagsChange,
}: InlineFacetedFilterProps) {
  const hasActiveFilters =
    Object.keys(selectedFilters).length > 0 || selectedTags.length > 0;

  if (facets.length === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {facets.slice(0, 4).map((facet) => (
        <select
          key={facet.name}
          value={selectedFilters[facet.name] || ""}
          onChange={(e) => {
            if (e.target.value) {
              onFilterChange({
                ...selectedFilters,
                [facet.name]: e.target.value,
              });
            } else {
              const newFilters = { ...selectedFilters };
              delete newFilters[facet.name];
              onFilterChange(newFilters);
            }
          }}
          className={cn(
            "h-9 rounded-lg border bg-background px-3 text-sm transition-colors",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            selectedFilters[facet.name] && "border-primary text-primary"
          )}
        >
          <option value="">All {facet.label}</option>
          {facet.values.map((fv) => (
            <option key={fv.value} value={fv.value}>
              {fv.value} ({fv.count})
            </option>
          ))}
        </select>
      ))}

      {/* Active filter chips */}
      {selectedTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onTagsChange(selectedTags.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-blue-500/20"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
