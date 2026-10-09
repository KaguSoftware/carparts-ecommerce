import { get, type FieldErrors, type FieldValues, type UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/action-result";
import type { LocalizedString } from "@/lib/i18n-string";

export const emptyLs = (): LocalizedString => ({ en: "", tr: "" });

/** Message (a validation code) of the error at a dot path, if any. */
export function errorCode(errors: FieldErrors<FieldValues>, path: string): string | undefined {
  const entry = get(errors, path) as { message?: unknown } | undefined;
  return typeof entry?.message === "string" && entry.message ? entry.message : undefined;
}

/** Push server field errors (`fieldErrors["name.en"] = ["required"]`) into react-hook-form. */
export function applyServerErrors<T extends FieldValues>(setError: UseFormSetError<T>, result: Extract<ActionResult<unknown>, { ok: false }>): void {
  for (const [path, codes] of Object.entries(result.fieldErrors ?? {})) {
    if (path === "_form" || !codes[0]) continue;
    setError(path as never, { type: "server", message: codes[0] });
  }
}

/** "2025-03-01" (date input) <-> ISO strings. End-of-day for `end` so a coupon works the whole last day. */
export function dateInputToIso(value: string, edge: "start" | "end"): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return edge === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.000Z`;
}
export function isoToDateInput(iso: string | undefined | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Digits-only integer parse for text inputs. Returns undefined for blank/invalid. */
export function parseIntInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
