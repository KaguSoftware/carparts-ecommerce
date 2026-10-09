"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Tag, X } from "lucide-react";
import { applyCouponAction, removeCouponAction } from "@/actions/store/cart";
import { Button, Input } from "@/components/ui";
import type { CurrencyContext } from "@/lib/money";
import { useErrorText } from "@/lib/hooks/use-error-text";

/** Discount code box. Applying or removing a code asks the parent to re-quote so the summary stays authoritative. */
export function CouponSection({ appliedCode, currency, onChanged }: { appliedCode?: string; currency: CurrencyContext; onChanged: () => void }) {
  const t = useTranslations("checkout.coupon");
  const { actionError } = useErrorText();
  const uid = useId().replace(/:/g, "");
  const inputId = `checkout-coupon-${uid}`;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await applyCouponAction({ code: code.trim() });
    setBusy(false);
    if (result.ok) {
      setCode("");
      onChanged();
    } else {
      setError(actionError(result, currency));
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await removeCouponAction();
    setBusy(false);
    if (result.ok) onChanged();
    else setError(actionError(result, currency));
  }

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm bg-success-soft px-3.5 py-2.5 text-sm text-success">
        <p className="flex min-w-0 items-center gap-2 font-medium">
          <Tag className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t("applied", { code: appliedCode })}</span>
        </p>
        <button type="button" onClick={remove} disabled={busy} aria-label={t("remove", { code: appliedCode })} className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm hover:bg-success/10">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    // Not a <form>: this box lives inside the checkout form and nested forms are invalid HTML.
    <div>
      <label htmlFor={inputId} className="sr-only">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("placeholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="uppercase"
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={() => void apply()} loading={busy} disabled={!code.trim()}>
          {t("apply")}
        </Button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
