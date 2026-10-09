"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { setProductImagesAction } from "@/actions/admin/products";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { LocalizedString } from "@/lib/i18n-string";
import { useAdminAction } from "../forms/use-admin-action";
import { uploadImage } from "../forms/ImageUpload";

interface Item {
  key: string;
  url: string;
  alt: LocalizedString;
}

let counter = 0;
const nextKey = () => `img-${++counter}`;

/** Gallery editor: upload, reorder (first image is the cover), alt text in both languages, remove. */
export function ImagesManager({ productId, initial, canWrite }: { productId: string; initial: { url: string; alt: LocalizedString }[]; canWrite: boolean }) {
  const t = useTranslations("admin.products.images");
  const tErr = useTranslations("errors");
  const { run, pending, errorText } = useAdminAction();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(() => initial.map((i) => ({ key: nextKey(), url: i.url, alt: { en: i.alt.en, tr: i.alt.tr } })));
  const [saved, setSaved] = useState(() => JSON.stringify(initial.map((i) => ({ url: i.url, alt: i.alt }))));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const snapshot = (list: Item[]) => JSON.stringify(list.map((i) => ({ url: i.url, alt: i.alt })));
  const dirty = snapshot(items) !== saved;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const added: Item[] = [];
    for (const file of Array.from(files)) {
      const result = await uploadImage(file);
      if (result.ok) added.push({ key: nextKey(), url: result.url, alt: { en: "", tr: "" } });
      else setUploadError(tErr.has(result.error) ? tErr(result.error) : tErr("unknown"));
    }
    setItems((cur) => [...cur, ...added]);
    setUploading(false);
    if (input.current) input.current.value = "";
  }

  const move = (index: number, dir: -1 | 1) =>
    setItems((cur) => {
      const next = [...cur];
      const target = index + dir;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const save = () =>
    run(() => setProductImagesAction({ productId, images: items.map((i) => ({ url: i.url, alt: i.alt })) }), {
      success: t("saved"),
      toastError: false,
      onSuccess: () => setSaved(snapshot(items)),
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("intro")}</p>
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {uploadError ? <Alert tone="danger">{uploadError}</Alert> : null}

      {items.length === 0 ? <p className="rounded-md border border-dashed border-border-strong p-8 text-center text-sm text-muted">{t("empty")}</p> : null}

      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.key} className="flex gap-3 rounded-md border border-border bg-surface p-3">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-sm border border-border bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.alt.en} width={96} height={96} className="size-full object-contain" />
              {index === 0 ? <span className="label-caps absolute left-0 top-0 bg-primary px-1.5 py-0.5 text-[0.6875rem] text-primary-foreground">{t("cover")}</span> : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Input size="sm" lang="en" aria-label={t("altEn")} placeholder={t("altEn")} value={item.alt.en} disabled={!canWrite} onChange={(e) => setItems((cur) => cur.map((i) => (i.key === item.key ? { ...i, alt: { ...i.alt, en: e.target.value } } : i)))} />
              <Input size="sm" lang="tr" aria-label={t("altTr")} placeholder={t("altTr")} value={item.alt.tr} disabled={!canWrite} onChange={(e) => setItems((cur) => cur.map((i) => (i.key === item.key ? { ...i, alt: { ...i.alt, tr: e.target.value } } : i)))} />
              {canWrite ? (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={() => setItems((cur) => cur.filter((i) => i.key !== item.key))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml" className="sr-only" aria-label={t("upload")} onChange={(e) => void onFiles(e.target.files)} />
          <Button type="button" variant="outline" loading={uploading} leftIcon={<ImagePlus className="size-4" />} onClick={() => input.current?.click()}>
            {t("upload")}
          </Button>
          <Button type="button" loading={pending} disabled={!dirty} onClick={() => void save()}>
            {t("save")}
          </Button>
          {dirty ? <span className="text-sm text-warning">{t("unsaved")}</span> : null}
          <span className="text-[0.8125rem] text-muted">{t("hint")}</span>
        </div>
      ) : null}
    </div>
  );
}
