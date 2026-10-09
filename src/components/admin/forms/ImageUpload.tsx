"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** POST one image to /api/uploads (staff only, validated by content on the server). */
export async function uploadImage(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && data.url) return { ok: true, url: data.url };
    return { ok: false, error: data.error ?? "unknown" };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

/** Hook-free helper component: a single-image picker (category/brand/banner images). */
export function ImageUploadField({ value, onChange, label, alt = "" }: { value?: string; onChange: (url: string | undefined) => void; label: string; alt?: string }) {
  const t = useTranslations("admin.common");
  const tErr = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadImage(file);
    setBusy(false);
    if (result.ok) onChange(result.url);
    else setError(tErr.has(result.error) ? tErr(result.error) : tErr("unknown"));
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={alt} width={80} height={80} className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-subtle" aria-hidden />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml" className="sr-only" aria-label={label} onChange={(e) => void pick(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>
              {value ? t("replaceImage") : t("uploadImage")}
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)} leftIcon={<Trash2 className="size-4" />}>
                {t("removeImage")}
              </Button>
            ) : null}
          </div>
          <p className="text-[0.8125rem] text-muted">{t("imageHint")}</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
