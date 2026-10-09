"use client";

import { useCallback } from "react";
import type { FieldErrors, FieldValues } from "react-hook-form";
import { useTranslations } from "next-intl";
import { errorCode } from "./form-utils";

/**
 * Translated message for the error at a react-hook-form path. Messages are validation codes (from the zod schemas or
 * pushed in from a Server Action's `fieldErrors`); unknown ones (zod's built-in English) fall back to "invalid value".
 */
export function useFieldError(errors: FieldErrors<FieldValues>) {
  const t = useTranslations("validation");
  return useCallback(
    (path: string): string | undefined => {
      const code = errorCode(errors, path);
      if (!code) return undefined;
      return t.has(code) ? t(code) : t("invalid_value");
    },
    [errors, t],
  );
}
