import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { ADMIN_LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from "./routing";

/**
 * Resolves the locale for every server render.
 * - Storefront routes: the `[locale]` URL segment.
 * - Admin routes (no segment): the `admin_locale` cookie, falling back to the default.
 * All areas load the same compiled message bundle (messages/<locale>.json).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale;
  if (isLocale(requested)) {
    locale = requested;
  } else {
    const fromCookie = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
    locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
    now: new Date(),
  };
});
