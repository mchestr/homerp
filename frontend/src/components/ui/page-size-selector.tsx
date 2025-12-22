"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PageSizeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  showAllOption?: boolean;
  totalItems?: number;
  className?: string;
}

const DEFAULT_OPTIONS = [12, 24, 48, 96];

export function PageSizeSelector({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  showAllOption = true,
  totalItems,
  className,
}: PageSizeSelectorProps) {
  const tCommon = useTranslations("common");

  // "all" is represented as 0 internally
  const handleChange = (newValue: string) => {
    if (newValue === "all") {
      onChange(0);
      return;
    }
    const parsed = parseInt(newValue, 10);
    onChange(Number.isNaN(parsed) ? options[0] : parsed);
  };

  const displayValue = value === 0 ? "all" : String(value);

  return (
    <div className={className}>
      <Select value={displayValue} onValueChange={handleChange}>
        <SelectTrigger
          className="h-9 min-h-[44px] w-auto min-w-[100px] gap-2 px-3"
          data-testid="page-size-selector"
        >
          <SelectValue placeholder={tCommon("itemsPerPage")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option}
              value={String(option)}
              data-testid={`page-size-${option}`}
            >
              {option} {tCommon("perPage")}
            </SelectItem>
          ))}
          {showAllOption && (
            <SelectItem value="all" data-testid="page-size-all">
              {tCommon("showAll")}
              {totalItems !== undefined && ` (${totalItems})`}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
