"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/action-result";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { useToast } from "@/components/ui/Toast";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

export interface RunOptions<T> {
  /** Already-translated success toast text. */
  success?: string;
  /** Re-fetch the server components of the current route after success (default true). */
  refresh?: boolean;
  /** Show the failure as a toast (default true). Forms pass false and render the error inline. */
  toastError?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (failure: Failure) => void;
}

/**
 * Runs a Server Action inside a transition, reports the outcome (toast) and refreshes the route.
 *
 *   const { run, pending } = useAdminAction();
 *   run(() => deleteBrandAction({ id }), { success: t("deleted") });
 */
export function useAdminAction() {
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Failure | null>(null);

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: RunOptions<T> = {}): Promise<boolean> =>
      new Promise((resolve) => {
        setError(null);
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await fn();
          } catch {
            // Network failure or an unexpected crash on the server.
            result = { ok: false, error: "unknown" };
          }
          if (result.ok) {
            if (opts.success) toast.success(opts.success);
            opts.onSuccess?.(result.data);
            if (opts.refresh !== false) router.refresh();
            resolve(true);
          } else {
            setError(result);
            if (opts.toastError !== false) toast.error(actionError(result));
            opts.onError?.(result);
            resolve(false);
          }
        });
      }),
    [router, toast, actionError],
  );

  const t = useTranslations("errors");
  const errorText = error ? (t.has(error.error) ? t(error.error, error.errorParams) : t("unknown")) : null;

  return { run, pending, error, errorText, clearError: () => setError(null) };
}
