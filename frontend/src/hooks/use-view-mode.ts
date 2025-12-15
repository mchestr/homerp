"use client";

import { useLocalStorage } from "./use-local-storage";

export type ViewMode = "grid" | "list";
export type TreeViewMode = "tree" | "grid" | "list";

export function useViewMode<T extends string>(
  storageKey: string,
  defaultMode: T,
  allowedModes: readonly T[]
): [T, (mode: T) => void] {
  const [storedValue, setStoredValue] = useLocalStorage<T>(
    storageKey,
    defaultMode
  );

  // Validate stored value is in allowed modes, fall back to default if not
  const validatedValue = allowedModes.includes(storedValue)
    ? storedValue
    : defaultMode;

  const setViewMode = (mode: T) => {
    if (allowedModes.includes(mode)) {
      setStoredValue(mode);
    }
  };

  return [validatedValue, setViewMode];
}
