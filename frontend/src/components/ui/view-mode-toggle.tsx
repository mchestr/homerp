"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewModeOption<T extends string> {
  value: T;
  icon: LucideIcon;
  label: string;
}

interface ViewModeToggleProps<T extends string> {
  value: T;
  onChange: (mode: T) => void;
  options: ViewModeOption<T>[];
  className?: string;
}

export function ViewModeToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: ViewModeToggleProps<T>) {
  return (
    <div
      className={cn("flex rounded-lg border p-1", className)}
      data-testid="view-mode-toggle"
      role="group"
      aria-label="View mode"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2 py-1.5 transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            title={option.label}
            aria-pressed={isActive}
            data-testid={`view-mode-${option.value}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
