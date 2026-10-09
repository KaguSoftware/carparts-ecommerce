import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/routing";

/** A translatable data field stored in the database: one string per supported locale. */
export type LocalizedString = Record<Locale, string>;

export function emptyLocalized(): LocalizedString {
  return { en: "", tr: "" };
}

/** Build a LocalizedString. If `tr` is omitted the English text is reused. */
export function ls(en: string, tr: string = en): LocalizedString {
  return { en, tr };
}

/**
 * Pick the string for `locale`, falling back to the default locale and then to any non-empty value.
 * Always use this (never `value[locale]` directly) so half-translated content degrades gracefully.
 */
export function localize(value: LocalizedString | null | undefined, locale: Locale | string): string {
  if (!value) return "";
  const direct = (value as Record<string, string>)[locale];
  if (direct && direct.trim()) return direct;
  const fallback = value[DEFAULT_LOCALE];
  if (fallback && fallback.trim()) return fallback;
  for (const l of LOCALES) if (value[l]?.trim()) return value[l];
  return "";
}

export function isLocalizedComplete(value: LocalizedString): boolean {
  return LOCALES.every((l) => (value[l] ?? "").trim().length > 0);
}
