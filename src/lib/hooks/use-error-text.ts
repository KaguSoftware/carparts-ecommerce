"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney, type CurrencyContext } from "@/lib/money";

/**
 * Translate server-provided codes.
 *
 *   const { fieldError, actionError } = useErrorText();
 *   <Field error={fieldError(result.fieldErrors, "email")} ... />
 *   {!result.ok && <Alert tone="danger">{actionError(result)}</Alert>}
 *
 * Pass the display `currency` to actionError for errors carrying a money param (`min` -> `amount`).
 * Unknown codes fall back to `errors.unknown` / the raw code so nothing renders blank.
 */
export function useErrorText() {
  const tErr = useTranslations("errors");
  const tVal = useTranslations("validation");
  const locale = useLocale();

  const validation = useCallback(
    (code: string, params?: Record<string, string | number>) => (tVal.has(code) ? tVal(code, params) : code),
    [tVal],
  );

  const fieldError = useCallback(
    (errors: Record<string, string[]> | undefined, field: string): string | undefined => {
      const first = errors?.[field]?.[0];
      return first ? validation(first) : undefined;
    },
    [validation],
  );

  const actionError = useCallback(
    (result: Extract<ActionResult<unknown>, { ok: false }>, currency?: CurrencyContext): string => {
      if (!tErr.has(result.error)) return tErr("unknown");
      const params = { ...result.errorParams };
      if (typeof params.what === "string") {
        const key = `what.${params.what.trim().replace(/\s+/g, "_")}`;
        params.what = tErr.has(key) ? tErr(key) : tErr("what.resource");
      }
      // Services only know USD minor units; money in messages is formatted here, in the shopper's locale/currency.
      if (typeof params.min === "number" && params.amount === undefined) params.amount = formatMoney(params.min, locale, currency);
      return tErr(result.error, params);
    },
    [tErr, locale],
  );

  return { validation, fieldError, actionError };
}
