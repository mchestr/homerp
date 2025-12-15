/**
 * Deep merge function to recursively merge translation objects.
 * Used for i18n fallback - merges locale-specific messages on top of base messages.
 *
 * - Undefined and null values in source are ignored (preserve target/fallback value)
 * - Arrays are replaced, not merged
 * - Original objects are not mutated
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue != null) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}
