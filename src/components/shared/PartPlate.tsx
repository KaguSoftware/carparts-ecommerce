"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Inline part / OE / SKU number in the brand's mono voice. Server-safe typography only, no behaviour. */
export function PartNo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("part-no whitespace-nowrap", className)}>{children}</span>;
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const t = useTranslations("ui.plate");
  const toast = useToast();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success(t("copied", { value }));
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("copy", { value })}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xs text-subtle transition-colors hover:bg-foreground/10 hover:text-foreground pointer-coarse:size-11",
        done && "text-success",
        className,
      )}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  );
}

export interface PartPlateProps {
  partNumber: string;
  oemNumbers?: string[];
  sku?: string;
  /** `lg` is the product-page data plate; `sm` is the compact row used in cart lines and summaries. */
  size?: "lg" | "sm";
  /** Manufacturer shown as a linked row on the large plate. */
  brand?: { name: string; href: string };
  /** Plays the press-in stamp animation once (a part just landed in the cart). */
  stamp?: boolean;
  /** `sm` only: part number over SKU without labels (for table cells that already have a column header). */
  stacked?: boolean;
  /** Hide the copy buttons (print, emails, static contexts). */
  noCopy?: boolean;
  className?: string;
}

/**
 * The brand's data plate: the part number set large in tracked mono inside a ruled, registration-marked frame,
 * followed by OE cross-references and the SKU. Each number copies with one tap.
 */
export function PartPlate({ partNumber, oemNumbers = [], sku, size = "lg", brand, stamp, stacked, noCopy, className }: PartPlateProps) {
  const t = useTranslations("ui.plate");
  const lg = size === "lg";
  const refs = oemNumbers.filter(Boolean);

  if (!lg && stacked) {
    return (
      <p className={cn("min-w-0 text-[0.8125rem] leading-snug", stamp && "stamp-in", className)}>
        <PartNo className="block text-foreground">{partNumber}</PartNo>
        {sku && sku !== partNumber ? <PartNo className="block text-[0.75rem] font-medium text-subtle">{sku}</PartNo> : null}
      </p>
    );
  }

  if (!lg) {
    return (
      <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]", stamp && "stamp-in", className)}>
        <span className="tag-mono text-subtle">{t("partNo")}</span>
        <PartNo className="text-foreground">{partNumber}</PartNo>
        {sku && sku !== partNumber ? (
          <>
            <span aria-hidden className="text-border-strong">
              /
            </span>
            <span className="tag-mono text-subtle">{t("sku")}</span>
            <PartNo className="font-medium text-muted">{sku}</PartNo>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <section aria-label={t("label")} className={cn("reg-marks border border-border-strong bg-surface-sunken", stamp && "stamp-in", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <p className="tag-mono text-muted">{t("partNo")}</p>
          <p className="part-no mt-1 break-all text-[clamp(1.375rem,1rem+1.6vw,1.875rem)] leading-none text-foreground">{partNumber}</p>
        </div>
        {noCopy ? null : <CopyButton value={partNumber} />}
      </div>
      {refs.length > 0 || sku || brand ? (
        <dl className="divide-y divide-border border-t border-border-strong text-[0.8125rem]">
          {brand ? (
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 px-4 py-2 sm:px-5">
              <dt className="tag-mono text-muted">{t("brand")}</dt>
              <dd>
                <Link href={brand.href} className="font-semibold text-foreground underline-offset-4 hover:text-primary-text hover:underline">
                  {brand.name}
                </Link>
              </dd>
            </div>
          ) : null}
          {refs.length > 0 ? (
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 px-4 py-1 sm:px-5">
              <dt className="tag-mono pt-3 text-muted">{t("oe")}</dt>
              <dd className="flex flex-wrap gap-x-2 gap-y-0">
                {refs.map((ref) => (
                  <span key={ref} className="inline-flex items-center">
                    <PartNo className="font-medium text-foreground">{ref}</PartNo>
                    {noCopy ? null : <CopyButton value={ref} />}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {sku ? (
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 px-4 py-0.5 sm:px-5">
              <dt className="tag-mono text-muted">{t("sku")}</dt>
              <dd className="flex items-center">
                <PartNo className="font-medium text-foreground">{sku}</PartNo>
                {noCopy ? null : <CopyButton value={sku} />}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
