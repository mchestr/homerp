"use client";

import { MapPin, ChevronDown, ChevronUp, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationSuggestionItem } from "@/lib/api/api";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type LocationSuggestionDisplayProps = {
  suggestions: LocationSuggestionItem[];
  onSelectLocation: (locationId: string) => void;
  selectedLocationId?: string;
};

export function LocationSuggestionDisplay({
  suggestions,
  onSelectLocation,
  selectedLocationId,
}: LocationSuggestionDisplayProps) {
  const t = useTranslations("locationSuggestion");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-950/30"
      data-testid="location-suggestion-section"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-violet-800 dark:text-violet-300">
            {t("title")}
          </h2>
          <p className="text-sm text-violet-600 dark:text-violet-400">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => {
          const isSelected = selectedLocationId === suggestion.location_id;
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={suggestion.location_id}
              className={cn(
                "rounded-lg bg-white/60 p-4 transition-all dark:bg-black/20",
                isSelected && "ring-2 ring-violet-500"
              )}
              data-testid={`location-suggestion-${index}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
                  <MapPin className="h-5 w-5 text-violet-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-violet-900 dark:text-violet-200">
                      {suggestion.location_name}
                    </span>
                    {index === 0 && (
                      <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-800 dark:text-violet-300">
                        {t("recommended")}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          suggestion.confidence >= 0.8
                            ? "bg-emerald-500"
                            : suggestion.confidence >= 0.5
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${suggestion.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-violet-600 dark:text-violet-400">
                      {Math.round(suggestion.confidence * 100)}%{" "}
                      {t("confidence")}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-violet-600 hover:bg-violet-100 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-900 dark:hover:text-violet-300"
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    data-testid={`toggle-reasoning-${index}`}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      isSelected
                        ? "bg-violet-500 text-white hover:bg-violet-600"
                        : "border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900"
                    )}
                    onClick={() => onSelectLocation(suggestion.location_id)}
                    data-testid={`select-location-${index}`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        {t("selected")}
                      </>
                    ) : (
                      t("useThis")
                    )}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded-lg bg-violet-100/50 p-3 text-sm text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  <p className="font-medium text-violet-800 dark:text-violet-200">
                    {t("whyRecommended")}
                  </p>
                  <p className="mt-1">{suggestion.reasoning}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-violet-600 dark:text-violet-400">
        {t("selectOrManual")}
      </p>
    </div>
  );
}
