"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, FileUp } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Report {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  dryRun: boolean;
}

/** Export the catalogue as CSV and import edits back (validate first with a dry run, then apply). */
export function CsvTools({ canImport }: { canImport: boolean }) {
  const t = useTranslations("admin.products.csv");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"dry" | "apply" | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setReport(null);
    setError(null);
  }

  async function submit(dryRun: boolean) {
    if (!file) return;
    setBusy(dryRun ? "dry" : "apply");
    setError(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch(`/api/admin/import/products${dryRun ? "?dryRun=1" : ""}`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as Partial<Report> & { error?: string };
      if (!res.ok) {
        setError(data.error && tErr.has(data.error) ? tErr(data.error) : tErr("unknown"));
        setReport(null);
      } else {
        const next: Report = { created: data.created ?? 0, updated: data.updated ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [], dryRun };
        setReport(next);
        if (!dryRun) {
          toast.success(t("imported", { created: next.created, updated: next.updated }));
          router.refresh();
        }
      }
    } catch {
      setError(tErr("unknown"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <a href="/api/admin/export/products" download className={buttonStyles({ variant: "outline", size: "sm" })}>
        <Download className="size-4" aria-hidden />
        {t("export")}
      </a>
      {canImport ? (
        <Button size="sm" variant="outline" leftIcon={<FileUp className="size-4" />} onClick={() => setOpen(true)}>
          {t("import")}
        </Button>
      ) : null}

      <Modal open={open} onClose={close} title={t("title")} description={t("description")} size="lg">
        <div className="space-y-4">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-border-strong file:bg-surface file:px-3 file:py-2 file:text-sm"
            aria-label={t("file")}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setError(null);
            }}
          />
          <ul className="list-disc space-y-1 pl-5 text-[0.8125rem] text-muted">
            <li>{t("tipRoundTrip")}</li>
            <li>{t("tipSku")}</li>
            <li>{t("tipDryRun")}</li>
          </ul>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {report ? (
            <div aria-live="polite" className="space-y-2">
              <Alert tone={report.errors.length > 0 ? "warning" : "success"} title={report.dryRun ? t("dryRunResult") : t("importResult")}>
                {t("summary", { created: report.created, updated: report.updated, skipped: report.skipped, errors: report.errors.length })}
              </Alert>
              {report.errors.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-border p-3 text-sm">
                  {report.errors.slice(0, 100).map((e, i) => (
                    <li key={i} className="py-0.5">
                      <span className="num font-medium">{t("row", { row: e.row })}</span> <span className="text-muted">{e.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={busy !== null}>
              {t("close")}
            </Button>
            <Button variant="outline" disabled={!file} loading={busy === "dry"} onClick={() => void submit(true)}>
              {t("validate")}
            </Button>
            <Button disabled={!file} loading={busy === "apply"} onClick={() => void submit(false)}>
              {t("apply")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
