"use client";

import { useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui";

const CARDS = [
  { key: "success", number: "4242424242424242", display: "4242 4242 4242 4242" },
  { key: "declined", number: "4000000000000002", display: "4000 0000 0000 0002" },
  { key: "insufficient", number: "4000000000009995", display: "4000 0000 0000 9995" },
  { key: "expired", number: "4000000000000069", display: "4000 0000 0000 0069" },
  { key: "error", number: "4000000000000119", display: "4000 0000 0000 0119" },
  { key: "threeDs", number: "4000002500003155", display: "4000 0025 0000 3155" },
] as const;

/** Development helper shown only while the mock payment gateway is active: one-click test card numbers. */
export function TestCards({ onUse }: { onUse: (number: string) => void }) {
  const t = useTranslations("checkout.testCards");
  return (
    <details className="rounded-md border border-dashed border-border-strong bg-surface-sunken p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <FlaskConical className="size-4 text-primary-text" aria-hidden />
        {t("title")}
      </summary>
      <p className="mt-2 text-sm text-muted">{t("body")}</p>
      <ul className="mt-3 divide-y divide-border">
        {CARDS.map((card) => (
          <li key={card.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t(`cases.${card.key}`)}</p>
              <p className="num text-[0.8125rem] text-muted">{card.display}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onUse(card.number)}>
              {t("use")}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
