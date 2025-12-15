"use client";

import { useLocalStorage } from "./use-local-storage";

/** Standard view modes for flat list pages (Items, Checked-Out, Gridfinity) */
export const VIEW_MODES = ["grid", "list"] as const;

/** Extended view modes for hierarchical pages (Categories, Locations) that include tree view */
export const TREE_VIEW_MODES = ["tree", "grid", "list"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];
export type TreeViewMode = (typeof TREE_VIEW_MODES)[number];

/** Prefix for all view mode localStorage keys to prevent collisions */
const STORAGE_PREFIX = "homerp:";

/**
 * Hook for managing view mode state with localStorage persistence.
 *
 * Features:
 * - Persists view mode preference to localStorage with `homerp:` prefix
 * - Validates stored value against allowed modes
 * - Falls back to default if stored value is invalid (e.g., after removing a view mode option)
 *
 * @param storageKey - Unique key for this view mode (will be prefixed with "homerp:")
 * @param defaultMode - Default view mode when no preference is stored
 * @param allowedModes - Array of valid view modes for this page
 * @returns Tuple of [currentMode, setMode]
 *
 * @example
 * // For flat list pages (Grid/List)
 * const [viewMode, setViewMode] = useViewMode("items-view-mode", "grid", VIEW_MODES);
 *
 * @example
 * // For hierarchical pages (Tree/Grid/List)
 * const [viewMode, setViewMode] = useViewMode("categories-view-mode", "tree", TREE_VIEW_MODES);
 */
export function useViewMode<T extends string>(
  storageKey: string,
  defaultMode: T,
  allowedModes: readonly T[]
): [T, (mode: T) => void] {
  const prefixedKey = `${STORAGE_PREFIX}${storageKey}`;

  const [storedValue, setStoredValue] = useLocalStorage<T>(
    prefixedKey,
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
