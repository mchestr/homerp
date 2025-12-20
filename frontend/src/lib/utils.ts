import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Date Formatting Utilities
// ============================================================================
// All functions accept ISO 8601 datetime strings from the API (with timezone info)
// and convert them to the user's local timezone for display.

/**
 * Format a date string to the user's locale with standard date format
 * Example: "Dec 12, 2024"
 *
 * @param dateString - ISO 8601 datetime string from API
 * @param locale - Optional locale override (default: browser locale)
 */
export function formatDate(
  dateString: string | null | undefined,
  locale?: string
): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format a date string to a short format (month and day only)
 * Example: "Dec 12"
 *
 * @param dateString - ISO 8601 datetime string from API
 * @param locale - Optional locale override (default: browser locale)
 */
export function formatDateShort(
  dateString: string | null | undefined,
  locale?: string
): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format a date string to include time
 * Example: "Dec 12, 2024 at 3:45 PM"
 *
 * @param dateString - ISO 8601 datetime string from API
 * @param locale - Optional locale override (default: browser locale)
 */
export function formatDateTime(
  dateString: string | null | undefined,
  locale?: string
): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Format a date string to include time with seconds
 * Example: "Dec 12, 2024, 3:45:30 PM"
 *
 * @param dateString - ISO 8601 datetime string from API
 * @param locale - Optional locale override (default: browser locale)
 */
export function formatDateTimeWithSeconds(
  dateString: string | null | undefined,
  locale?: string
): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Format a date string to relative time
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 *
 * Falls back to standard date format for dates older than 7 days.
 *
 * @param dateString - ISO 8601 datetime string from API
 * @param locale - Optional locale override (default: browser locale)
 */
export function formatRelativeTime(
  dateString: string | null | undefined,
  locale?: string
): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Handle future dates
    if (diffMs < 0) {
      return formatDate(dateString, locale);
    }

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Fallback to standard date format
    return formatDate(dateString, locale);
  } catch {
    return "";
  }
}

// ============================================================================
// Quantity Parsing Utilities
// ============================================================================

/**
 * Unit aliases for normalizing quantity units
 */
const UNIT_ALIASES: Record<string, string> = {
  pieces: "pcs",
  piece: "pcs",
  pcs: "pcs",
  pc: "pcs",
  units: "pcs",
  unit: "pcs",
  items: "pcs",
  item: "pcs",
  meters: "m",
  meter: "m",
  m: "m",
  centimeters: "cm",
  centimeter: "cm",
  cm: "cm",
  millimeters: "mm",
  millimeter: "mm",
  mm: "mm",
  feet: "ft",
  foot: "ft",
  ft: "ft",
  inches: "in",
  inch: "in",
  in: "in",
  kilograms: "kg",
  kilogram: "kg",
  kg: "kg",
  grams: "g",
  gram: "g",
  g: "g",
  pounds: "lb",
  pound: "lb",
  lbs: "lb",
  lb: "lb",
  ounces: "oz",
  ounce: "oz",
  oz: "oz",
  liters: "L",
  liter: "L",
  l: "L",
  milliliters: "mL",
  milliliter: "mL",
  ml: "mL",
  rolls: "rolls",
  roll: "rolls",
  packs: "packs",
  pack: "packs",
  boxes: "boxes",
  box: "boxes",
  bags: "bags",
  bag: "bags",
  sets: "sets",
  set: "sets",
  pairs: "pairs",
  pair: "pairs",
};

export type ParsedQuantity = {
  quantity: number;
  quantity_unit: string;
};

/**
 * Parse a quantity estimate string into numeric quantity and unit.
 *
 * @example
 * parseQuantityEstimate("5 pieces") // { quantity: 5, quantity_unit: "pcs" }
 * parseQuantityEstimate("approximately 10") // { quantity: 10, quantity_unit: "pcs" }
 * parseQuantityEstimate("10m of cable") // { quantity: 10, quantity_unit: "m" }
 * parseQuantityEstimate("about 25 meters") // { quantity: 25, quantity_unit: "m" }
 * parseQuantityEstimate(null) // { quantity: 1, quantity_unit: "pcs" }
 */
export function parseQuantityEstimate(
  estimate: string | null | undefined
): ParsedQuantity {
  if (!estimate) {
    return { quantity: 1, quantity_unit: "pcs" };
  }

  const normalizedEstimate = estimate.trim().toLowerCase();

  // Pattern 1: "10m", "5kg", "25cm" (number directly followed by unit abbreviation)
  const directMatch = normalizedEstimate.match(
    /^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)/
  );
  if (directMatch) {
    const [, numStr, unitStr] = directMatch;
    const quantity = Math.max(1, Math.floor(parseFloat(numStr)));
    const unit = UNIT_ALIASES[unitStr.toLowerCase()] || "pcs";
    return { quantity, quantity_unit: unit };
  }

  // Pattern 2: Extract first number and look for unit words
  // Matches patterns like "approximately 10 pieces", "about 5", "around 25 meters"
  const numMatch = normalizedEstimate.match(/(-?\d+(?:\.\d+)?)/);
  if (numMatch) {
    const quantity = Math.max(1, Math.floor(parseFloat(numMatch[1])));

    // Look for unit words in the rest of the string
    let unit = "pcs"; // Default
    for (const [alias, normalizedUnit] of Object.entries(UNIT_ALIASES)) {
      // Escape special regex characters in alias
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedAlias}\\b`);
      if (regex.test(normalizedEstimate)) {
        unit = normalizedUnit;
        break;
      }
    }

    return { quantity, quantity_unit: unit };
  }

  // Fallback: couldn't parse, return defaults
  return { quantity: 1, quantity_unit: "pcs" };
}

// ============================================================================
// Currency Formatting Utilities
// ============================================================================

/**
 * Currency code to symbol mapping for common currencies
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹",
  MXN: "$",
  BRL: "R$",
  KRW: "₩",
};

/**
 * Format a price value with the appropriate currency symbol
 * @param price - The price value (can be number, string, or null)
 * @param currency - The ISO 4217 currency code (default: USD)
 * @returns Formatted price string or null if price is null/undefined
 */
export function formatPrice(
  price: number | string | null | undefined,
  currency: string = "USD"
): string | null {
  if (price == null) return null;

  const numericPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numericPrice)) return null;

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  // For JPY and KRW, no decimal places are typically used
  const decimals = ["JPY", "KRW"].includes(currency) ? 0 : 2;

  return `${symbol}${numericPrice.toFixed(decimals)}`;
}

// ============================================================================
// API Error Utilities
// ============================================================================

/**
 * Check if an error is an insufficient credits error (HTTP 402)
 * Used for handling payment-required responses from AI features
 */
export function isInsufficientCreditsError(err: unknown): boolean {
  return (
    err != null &&
    typeof err === "object" &&
    "status" in err &&
    (err as { status: number }).status === 402
  );
}

// ============================================================================
// Item Attribute Utilities
// ============================================================================

/**
 * Type guard to check if a value is a valid specifications object
 */
function isSpecificationsObject(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

interface ItemSubtitleParams {
  attributes?: Record<string, unknown> | null;
  category?: {
    attribute_template?: {
      fields?: Array<{
        name: string;
        label: string;
      }>;
    } | null;
  } | null;
  maxAttributes?: number;
}

/**
 * Extract a subtitle from item attributes to display under the item title.
 * Uses the category's attribute template to prioritize which attributes to show.
 * Falls back to showing the first attributes in insertion order if no template exists.
 *
 * @example
 * // With template (e.g., filament category with "type" and "color" fields)
 * getItemSubtitle({
 *   attributes: { specifications: { type: "PLA", color: "Blue", diameter: "1.75mm" } },
 *   category: { attribute_template: { fields: [{ name: "type", label: "Type" }, { name: "color", label: "Color" }] } }
 * })
 * // Returns: "PLA, Blue"
 *
 * @example
 * // Without template (shows first 2-3 attributes in insertion order)
 * getItemSubtitle({
 *   attributes: { specifications: { material: "Wood", size: "Large" } }
 * })
 * // Returns: "Wood, Large"
 *
 * @param params - Item attributes and category information
 * @returns Formatted subtitle string or null if no attributes exist
 */
export function getItemSubtitle({
  attributes,
  category,
  maxAttributes = 3,
}: ItemSubtitleParams): string | null {
  if (!attributes) return null;

  const specs = attributes["specifications"];
  if (!isSpecificationsObject(specs)) return null;

  const specEntries = Object.entries(specs);
  if (specEntries.length === 0) return null;

  // If category has an attribute template, use it to prioritize attributes
  const templateFields = category?.attribute_template?.fields;
  let subtitleParts: string[] = [];

  if (templateFields && templateFields.length > 0) {
    // Use template field order to prioritize attributes
    for (const field of templateFields.slice(0, maxAttributes)) {
      const value = specs[field.name];
      if (value != null && value !== "") {
        subtitleParts.push(String(value));
      }
    }
  }

  // If no template or template didn't provide enough attributes,
  // fall back to showing first attributes in insertion order
  if (subtitleParts.length === 0) {
    const firstEntries = specEntries.slice(0, maxAttributes);

    subtitleParts = firstEntries.reduce((acc, [, value]) => {
      if (value != null && value !== "") {
        acc.push(String(value));
      }
      return acc;
    }, [] as string[]);
  }

  return subtitleParts.length > 0 ? subtitleParts.join(", ") : null;
}
