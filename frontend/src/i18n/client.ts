"use client";

import { type Locale, locales } from "./config";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function setLocaleCookie(locale: Locale): void {
  if (!locales.includes(locale)) {
    console.error(`Invalid locale: ${locale}`);
    return;
  }

  // Set cookie with 1 year expiration
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

export function getLocaleFromCookie(): Locale | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(^| )${LOCALE_COOKIE_NAME}=([^;]+)`)
  );
  const value = match?.[2];

  if (value && locales.includes(value as Locale)) {
    return value as Locale;
  }

  return null;
}
