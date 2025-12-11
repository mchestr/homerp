import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
