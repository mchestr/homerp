"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TimeRange } from "@/lib/api/api-client";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

export function TimeRangeSelector({
  value,
  onChange,
  className,
}: TimeRangeSelectorProps) {
  const t = useTranslations("admin.timeRange");

  const ranges: { value: TimeRange; label: string }[] = [
    { value: "7d", label: t("7d") },
    { value: "30d", label: t("30d") },
    { value: "90d", label: t("90d") },
  ];

  return (
    <div
      className={cn("bg-muted inline-flex rounded-lg border p-1", className)}
      data-testid="time-range-selector"
    >
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === range.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`time-range-${range.value}`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
