"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { LocalizedString } from "@/lib/i18n-string";
import { emptyLs } from "./form-utils";

export type LocalizedPair<K extends string> = Record<K, LocalizedString> & { value: LocalizedString };

/**
 * Repeating rows of "name -> value", each side localised (EN + TR). Used for product specs (key/value) and
 * variant options (name/value).
 */
export function PairsEditor<K extends "key" | "name">({
  field,
  value,
  onChange,
  labels,
  max = 30,
}: {
  field: K;
  value: LocalizedPair<K>[];
  onChange: (value: LocalizedPair<K>[]) => void;
  labels: { key: string; value: string; add: string; remove: string; empty: string };
  max?: number;
}) {
  const t = useTranslations("admin.common");
  const update = (index: number, side: K | "value", locale: "en" | "tr", text: string) =>
    onChange(value.map((row, i) => (i === index ? ({ ...row, [side]: { ...row[side], [locale]: text } } as LocalizedPair<K>) : row)));
  const blank = { [field]: emptyLs(), value: emptyLs() } as LocalizedPair<K>;

  return (
    <div className="space-y-3">
      {value.length === 0 ? <p className="text-sm text-muted">{labels.empty}</p> : null}
      {value.map((row, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border border-border p-3">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            {(["en", "tr"] as const).map((locale) => (
              <div key={locale} className="grid gap-2">
                <Input
                  size="sm"
                  lang={locale}
                  aria-label={`${labels.key} (${t(`lang.${locale}`)})`}
                  placeholder={`${labels.key} (${locale.toUpperCase()})`}
                  value={row[field][locale]}
                  onChange={(e) => update(index, field, locale, e.target.value)}
                />
                <Input
                  size="sm"
                  lang={locale}
                  aria-label={`${labels.value} (${t(`lang.${locale}`)})`}
                  placeholder={`${labels.value} (${locale.toUpperCase()})`}
                  value={row.value[locale]}
                  onChange={(e) => update(index, "value", locale, e.target.value)}
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.remove} onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {value.length < max ? (
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => onChange([...value, blank])}>
          {labels.add}
        </Button>
      ) : null}
    </div>
  );
}
