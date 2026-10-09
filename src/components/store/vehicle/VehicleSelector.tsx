"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CarFront, ChevronDown } from "lucide-react";
import { setVehicleAction } from "@/actions/store/vehicle";
import { Alert, Button, Select, useToast } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";
import type { VehicleModel, VehicleMake, VehicleSelection, VehicleView } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export interface VehicleSelectorProps {
  /** Current saved selection (pre-fills the cascade). */
  initial?: VehicleSelection;
  /** `row`: selects side by side on wide screens. `stack`: one column (dialogs, sidebars). `plate`: ruled title-block boxes on the fixed light drawing sheet (home hero). */
  layout?: "row" | "stack" | "plate";
  submitLabel?: string;
  onSaved?: (result: { label: string; selection: VehicleSelection }) => void;
  className?: string;
  /** Prefix for element ids when the selector is rendered twice on one page. */
  idPrefix?: string;
}

/**
 * Make -> model -> year -> engine cascade backed by /api/vehicles/*. Saves to the `vehicle` cookie through
 * `setVehicleAction` ("My Garage") and refreshes the page so listings re-filter.
 */
export function VehicleSelector({ initial, layout = "stack", submitLabel, onSaved, className, idPrefix }: VehicleSelectorProps) {
  const t = useTranslations("store.vehicle");
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${idPrefix ?? "vs"}-${uid}-${name}`;

  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [engines, setEngines] = useState<VehicleView[]>([]);
  const [makeId, setMakeId] = useState(initial?.makeId ?? "");
  const [modelId, setModelId] = useState(initial?.modelId ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ctrl = new AbortController();
    getJson<{ makes: VehicleMake[] }>("/api/vehicles/makes", ctrl.signal)
      .then((r) => setMakes(r.makes))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoadError(true);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!makeId) return;
    const ctrl = new AbortController();
    getJson<{ models: VehicleModel[] }>(`/api/vehicles/models?makeId=${encodeURIComponent(makeId)}`, ctrl.signal)
      .then((r) => setModels(r.models))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoadError(true);
      });
    return () => ctrl.abort();
  }, [makeId]);

  useEffect(() => {
    if (!modelId) return;
    const ctrl = new AbortController();
    getJson<{ years: number[] }>(`/api/vehicles/years?modelId=${encodeURIComponent(modelId)}`, ctrl.signal)
      .then((r) => setYears(r.years))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoadError(true);
      });
    return () => ctrl.abort();
  }, [modelId]);

  useEffect(() => {
    if (!modelId || !year) return;
    const ctrl = new AbortController();
    getJson<{ engines: VehicleView[] }>(`/api/vehicles/engines?modelId=${encodeURIComponent(modelId)}&year=${encodeURIComponent(year)}`, ctrl.signal)
      .then((r) => setEngines(r.engines))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoadError(true);
      });
    return () => ctrl.abort();
  }, [modelId, year]);

  const modelOptions = makeId ? models : [];
  const yearOptions = modelId ? years : [];
  const engineOptions = modelId && year ? engines : [];

  function save() {
    if (!makeId) return;
    setError(null);
    const selection: VehicleSelection = {
      makeId,
      ...(modelId ? { modelId } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(vehicleId ? { vehicleId } : {}),
    };
    startTransition(async () => {
      const result = await setVehicleAction(selection);
      if (result.ok) {
        toast.success(t("saved", { label: result.data.label }));
        onSaved?.({ label: result.data.label, selection: result.data.selection });
        router.refresh();
      } else {
        setError(actionError(result));
      }
    });
  }

  if (layout === "plate") {
    const cells: { key: string; label: string; value: string; disabled: boolean; placeholder: string; options: { value: string; label: string }[]; onChange: (v: string) => void }[] = [
      {
        key: "make",
        label: t("make"),
        value: makeId,
        disabled: false,
        placeholder: t("selectMake"),
        options: makes.map((m) => ({ value: m.id, label: m.name })),
        onChange: (v) => {
          setMakeId(v);
          setModelId("");
          setYear("");
          setVehicleId("");
          setModels([]);
          setYears([]);
          setEngines([]);
        },
      },
      {
        key: "model",
        label: t("model"),
        value: modelId,
        disabled: !makeId,
        placeholder: t("selectModel"),
        options: modelOptions.map((m) => ({ value: m.id, label: m.name })),
        onChange: (v) => {
          setModelId(v);
          setYear("");
          setVehicleId("");
          setYears([]);
          setEngines([]);
        },
      },
      {
        key: "year",
        label: t("year"),
        value: year,
        disabled: !modelId,
        placeholder: t("anyYear"),
        options: yearOptions.map((y) => ({ value: String(y), label: String(y) })),
        onChange: (v) => {
          setYear(v);
          setVehicleId("");
          setEngines([]);
        },
      },
      {
        key: "engine",
        label: t("engine"),
        value: vehicleId,
        disabled: !year,
        placeholder: t("anyEngine"),
        options: engineOptions.map((v) => ({ value: v.id, label: v.engine })),
        onChange: (v) => setVehicleId(v),
      },
    ];
    return (
      <form
        className={cn("space-y-3", className)}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-2 border border-sheet-ink bg-sheet text-sheet-ink lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          {cells.map((c, i) => (
            <div
              key={c.key}
              className={cn(
                "relative border-sheet-line px-3.5 pb-1.5 pt-2.5 transition-colors has-[:focus-visible]:bg-white has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-sheet-accent",
                i % 2 === 1 && "border-l",
                i >= 2 && "border-t lg:border-t-0",
                i > 0 && "lg:border-l",
              )}
            >
              <label htmlFor={id(c.key)} className="tag-mono block text-sheet-muted">
                {c.label}
              </label>
              <select
                id={id(c.key)}
                value={c.value}
                disabled={c.disabled}
                onChange={(e) => c.onChange(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-[0.875rem] font-semibold text-sheet-ink outline-none disabled:cursor-not-allowed disabled:text-sheet-muted disabled:opacity-60"
              >
                <option value="">{c.placeholder}</option>
                {c.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-sheet-muted" />
            </div>
          ))}
          <div className="col-span-2 flex border-t border-sheet-ink lg:col-span-1 lg:border-l lg:border-t-0">
            <Button type="submit" loading={pending} disabled={!makeId} leftIcon={<CarFront className="size-5" aria-hidden />} className="h-14 w-full rounded-none px-4 lg:h-full lg:min-w-36">
              {submitLabel ?? t("save")}
            </Button>
          </div>
        </div>
        {loadError ? <Alert tone="danger">{t("loadError")}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    );
  }

  const grid = layout === "row" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" : "grid gap-3";
  const sel = "";
  return (
    <form
      className={cn("space-y-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className={grid}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("make")} className="text-sm font-medium">
            {t("make")}
          </label>
          <Select
            id={id("make")}
            value={makeId}
            className={sel}
            onChange={(e) => {
              setMakeId(e.target.value);
              setModelId("");
              setYear("");
              setVehicleId("");
              setModels([]);
              setYears([]);
              setEngines([]);
            }}
          >
            <option value="">{t("selectMake")}</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("model")} className="text-sm font-medium">
            {t("model")}
          </label>
          <Select
            id={id("model")}
            value={modelId}
            disabled={!makeId}
            onChange={(e) => {
              setModelId(e.target.value);
              setYear("");
              setVehicleId("");
              setYears([]);
              setEngines([]);
            }}
          >
            <option value="">{t("selectModel")}</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("year")} className="text-sm font-medium">
            {t("year")}
          </label>
          <Select
            id={id("year")}
            value={year}
            disabled={!modelId}
            onChange={(e) => {
              setYear(e.target.value);
              setVehicleId("");
              setEngines([]);
            }}
          >
            <option value="">{t("anyYear")}</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("engine")} className="text-sm font-medium">
            {t("engine")}
          </label>
          <Select id={id("engine")} value={vehicleId} disabled={!year} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">{t("anyEngine")}</option>
            {engineOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.engine}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" loading={pending} disabled={!makeId} leftIcon={<CarFront className="size-5" aria-hidden />} fullWidth={layout === "stack"}>
          {submitLabel ?? t("save")}
        </Button>
      </div>

      {loadError ? <Alert tone="danger">{t("loadError")}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
