"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, X } from "lucide-react";
import { addFitmentAction, addFitmentMatchingAction, clearFitmentAction, removeFitmentAction, searchVehiclesAction } from "@/actions/admin/vehicles";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { useAdminAction } from "../forms/use-admin-action";

export interface FitmentEditorProps {
  productId: string;
  fitmentType: "universal" | "specific";
  current: { vehicleId: string; label: string; fuel: string }[];
  makes: { id: string; name: string }[];
  models: { id: string; makeId: string; name: string }[];
  canWrite: boolean;
}

interface SearchResult {
  total: number;
  page: number;
  pageCount: number;
  items: { id: string; label: string; engine: string; fuel: string; year: number }[];
}

const SHOWN = 150;

/** Compatibility editor: see which vehicles a part fits, search the vehicle table and add one, many or all matches. */
export function FitmentEditor({ productId, fitmentType, current, makes, models, canWrite }: FitmentEditorProps) {
  const t = useTranslations("admin.products.fitment");
  const tFuel = useTranslations("admin.vehicles.fuel");
  const { run, pending } = useAdminAction();
  const [filter, setFilter] = useState("");
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fitIds = useMemo(() => new Set(current.map((c) => c.vehicleId)), [current]);
  const visibleCurrent = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (needle ? current.filter((c) => c.label.toLowerCase().includes(needle)) : current).slice(0, SHOWN);
  }, [current, filter]);
  const modelOptions = models.filter((m) => !makeId || m.makeId === makeId);

  function search(page = 1) {
    return run(() => searchVehiclesAction({ q: q || undefined, makeId: makeId || undefined, modelId: modelId || undefined, page }), {
      refresh: false,
      onSuccess: (data) => {
        setResults(data);
        setSelected(new Set());
      },
    });
  }

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectable = results?.items.filter((r) => !fitIds.has(r.id)) ?? [];

  return (
    <div className="space-y-5">
      {fitmentType === "universal" ? <Alert tone="info">{t("universalNote")}</Alert> : null}

      <section aria-labelledby="fit-current">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 id="fit-current" className="display-4">
            {t("current", { count: current.length })}
          </h3>
          <div className="flex items-center gap-2">
            <Input size="sm" type="search" aria-label={t("filterCurrent")} placeholder={t("filterCurrent")} value={filter} onChange={(e) => setFilter(e.target.value)} leading={<Search />} />
            {canWrite && current.length > 0 ? (
              <ConfirmActionButton
                variant="outline"
                action={clearFitmentAction.bind(null, { productId })}
                title={t("clearTitle")}
                description={t("clearBody", { count: current.length })}
                confirmLabel={t("clearConfirm")}
                success={t("cleared")}
              >
                {t("clearAll")}
              </ConfirmActionButton>
            ) : null}
          </div>
        </div>
        {current.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-6 text-center text-sm text-muted">{t("none")}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border bg-surface">
            {visibleCurrent.map((c) => (
              <li key={c.vehicleId} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate">
                  {c.label} <span className="text-muted">({tFuel(c.fuel)})</span>
                </span>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { label: c.label })}
                    disabled={pending}
                    onClick={() => void run(() => removeFitmentAction({ productId, vehicleIds: [c.vehicleId] }))}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {current.length > SHOWN ? <p className="mt-1.5 text-[0.8125rem] text-muted">{t("truncated", { shown: Math.min(SHOWN, visibleCurrent.length) })}</p> : null}
      </section>

      {canWrite ? (
        <section aria-labelledby="fit-add" className="rounded-md border border-border bg-surface p-4">
          <h3 id="fit-add" className="display-4 mb-3">
            {t("addTitle")}
          </h3>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void search(1);
            }}
          >
            <label className="flex min-w-40 flex-col gap-1">
              <span className="label-caps text-muted">{t("make")}</span>
              <Select
                size="sm"
                value={makeId}
                onChange={(e) => {
                  setMakeId(e.target.value);
                  setModelId("");
                }}
              >
                <option value="">{t("any")}</option>
                {makes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-40 flex-col gap-1">
              <span className="label-caps text-muted">{t("model")}</span>
              <Select size="sm" value={modelId} onChange={(e) => setModelId(e.target.value)}>
                <option value="">{t("any")}</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className="label-caps text-muted">{t("text")}</span>
              <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("textPlaceholder")} />
            </label>
            <Button type="submit" size="sm" variant="secondary" loading={pending} leftIcon={<Search className="size-4" />}>
              {t("search")}
            </Button>
          </form>

          {results ? (
            <div className="mt-4" aria-live="polite">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">{t("results", { count: results.total })}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={selectable.length === 0}
                    onClick={() => setSelected(new Set(selectable.map((r) => r.id)))}
                  >
                    {t("selectPage")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={selected.size === 0 || pending}
                    leftIcon={<Plus className="size-4" />}
                    onClick={() =>
                      void run(() => addFitmentAction({ productId, vehicleIds: [...selected] }), {
                        success: t("added"),
                        onSuccess: () => {
                          setSelected(new Set());
                          void search(results.page);
                        },
                      })
                    }
                  >
                    {t("addSelected", { count: selected.size })}
                  </Button>
                  {results.total > 0 ? (
                    <ConfirmActionButton
                      variant="secondary"
                      tone="primary"
                      action={addFitmentMatchingAction.bind(null, { productId, q: q || undefined, makeId: makeId || undefined, modelId: modelId || undefined })}
                      title={t("addAllTitle")}
                      description={t("addAllBody", { count: results.total })}
                      confirmLabel={t("addAllConfirm")}
                      success={t("added")}
                      onDone={() => void search(1)}
                    >
                      {t("addAll", { count: results.total })}
                    </ConfirmActionButton>
                  ) : null}
                </div>
              </div>
              {results.items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-strong p-6 text-center text-sm text-muted">{t("noResults")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {results.items.map((r) => {
                    const already = fitIds.has(r.id);
                    return (
                      <li key={r.id} className="px-3 py-1.5">
                        <Checkbox
                          label={
                            <span className="text-sm">
                              {r.label} <span className="text-muted">({tFuel(r.fuel)})</span>
                              {already ? <span className="ml-2 text-success">{t("alreadyFits")}</span> : null}
                            </span>
                          }
                          checked={already || selected.has(r.id)}
                          disabled={already}
                          onChange={() => toggle(r.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              {results.pageCount > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button type="button" size="sm" variant="outline" disabled={results.page <= 1 || pending} onClick={() => void search(results.page - 1)}>
                    {t("prev")}
                  </Button>
                  <span className="num text-sm text-muted">{t("pageOf", { page: results.page, pages: results.pageCount })}</span>
                  <Button type="button" size="sm" variant="outline" disabled={results.page >= results.pageCount || pending} onClick={() => void search(results.page + 1)}>
                    {t("next")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
