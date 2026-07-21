import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/**
 * Reads the visitor's saved language from the locale cookie (server only).
 * Cached per request — called by the root layout and by most page bodies.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});
