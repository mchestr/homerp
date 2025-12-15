import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";
import { deepMerge } from "@/lib/deep-merge";

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  // Always load English as the base (fallback) messages
  const englishMessages = (await import(`../../messages/en.json`)).default;

  // If the locale is English, just return English messages
  if (locale === "en") {
    return {
      locale,
      messages: englishMessages,
    };
  }

  // For other locales, try to load locale-specific messages and merge with English
  try {
    const localeMessages = (await import(`../../messages/${locale}.json`))
      .default;
    // Merge: English is base, locale-specific overrides
    const mergedMessages = deepMerge(englishMessages, localeMessages);

    return {
      locale,
      messages: mergedMessages,
    };
  } catch {
    // If locale file doesn't exist, fall back to English entirely
    return {
      locale,
      messages: englishMessages,
    };
  }
});
