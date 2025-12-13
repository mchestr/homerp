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
