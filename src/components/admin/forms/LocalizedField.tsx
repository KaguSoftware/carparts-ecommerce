"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LOCALES, type Locale } from "@/i18n/routing";
import type { LocalizedString } from "@/lib/i18n-string";
import { cn } from "@/lib/utils";

export interface LocalizedFieldProps {
  label: string;
  value: LocalizedString;
  onChange: (value: LocalizedString) => void;
  /** Already-translated error text per locale. */
  errors?: Partial<Record<Locale, string | undefined>>;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  /** English is mandatory (the storefront falls back to it); Turkish is optional but flagged when empty. */
  required?: boolean;
  placeholder?: Partial<Record<Locale, string>>;
  maxLength?: number;
  className?: string;
  /** Monospace for markdown bodies. */
  mono?: boolean;
}

/** Side-by-side English / Turkish editor for one LocalizedString, with a gentle warning when Turkish is missing. */
export function LocalizedField({ label, value, onChange, errors, hint, multiline, rows = 4, required, placeholder, maxLength, className, mono }: LocalizedFieldProps) {
  const t = useTranslations("admin.common");
  const legendId = useId();
  const trMissing = !value.tr.trim() && (value.en.trim().length > 0 || required);
  return (
    <fieldset className={cn("min-w-0", className)} aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1.5 text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCALES.map((locale) => {
          const common = {
            lang: locale,
            value: value[locale],
            maxLength,
            placeholder: placeholder?.[locale],
            onChange: (e: { target: { value: string } }) => onChange({ ...value, [locale]: e.target.value }),
          };
          return (
            <Field
              key={locale}
              label={<span className="label-caps text-muted">{t(`lang.${locale}`)}</span>}
              error={errors?.[locale]}
              required={required && locale === "en"}
              hint={locale === "tr" && trMissing && !errors?.tr ? <span className="text-warning">{t("missingTranslation")}</span> : undefined}
            >
              {multiline ? <Textarea rows={rows} className={cn(mono && "font-mono text-sm")} {...common} /> : <Input size="sm" {...common} />}
            </Field>
          );
        })}
      </div>
      {hint ? <p className="mt-1.5 text-[0.8125rem] text-muted">{hint}</p> : null}
    </fieldset>
  );
}
