"use client";

import { useTranslations } from "next-intl";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Live checklist mirroring the server password policy (10+ characters, upper and lower case, a number). */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  const t = useTranslations("auth.password");
  const rules = [
    { key: "length", ok: value.length >= 10, label: t("ruleLength") },
    { key: "case", ok: /[a-z]/.test(value) && /[A-Z]/.test(value), label: t("ruleCase") },
    { key: "number", ok: /\d/.test(value), label: t("ruleNumber") },
  ];
  return (
    <ul id={id} className="space-y-1" aria-label={t("rulesLabel")}>
      {rules.map((rule) => (
        <li key={rule.key} className={cn("flex items-center gap-2 text-[0.8125rem]", rule.ok ? "text-success" : "text-muted")}>
          {rule.ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.ok ? t("ruleMet") : t("ruleUnmet")}</span>
        </li>
      ))}
    </ul>
  );
}
