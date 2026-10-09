import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { getFitmentSummary, getVehicle, resolveSelection } from "@/lib/services/vehicles";
import type { VehicleSelection } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const MAX_YEARS = 18;

/**
 * Fitment as proof: a make x model-year matrix. Filled cells are fitted model years, the cell(s) matching the
 * vehicle saved in My Garage are marked with a check. Grouped per make (first one open); scrolls sideways on phones
 * with the model name pinned.
 */
export async function FitmentList({ productId, universal, selection }: { productId: string; universal: boolean; selection?: VehicleSelection }) {
  const t = await getTranslations("store.fitment");
  if (universal) return <p className="max-w-prose text-muted">{t("universalBody")}</p>;
  const groups = await getFitmentSummary(productId);
  if (groups.length === 0) return <p className="text-muted">{t("noVehicles")}</p>;

  // Which (make|model|year) cells belong to the garage vehicle?
  const mine = new Set<string>();
  if (selection) {
    const ids = await resolveSelection(selection);
    const views = await Promise.all(ids.slice(0, 40).map((id) => getVehicle(id)));
    for (const v of views) if (v) mine.add(`${v.make.name}|${v.model.name}|${v.year}`);
  }

  const allYears = [...new Set(groups.flatMap((g) => g.models.flatMap((m) => m.years)))].sort((a, b) => a - b);
  const years = allYears.length > MAX_YEARS ? allYears.slice(-MAX_YEARS) : allYears;
  const total = groups.reduce((n, g) => n + g.models.length, 0);
  const hasMine = mine.size > 0;
  const mineFits = groups.some((g) => g.models.some((m) => m.years.some((y) => mine.has(`${g.make}|${m.model}|${y}`))));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-muted">{t("compatibleCount", { count: total })}</p>
        <p className="tag-mono flex flex-wrap items-center gap-x-5 gap-y-1 text-muted" aria-hidden>
          <span className="inline-flex items-center gap-2">
            <span className="size-3.5 bg-secondary" />
            {t("legendFits")}
          </span>
          {hasMine ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex size-3.5 items-center justify-center bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={4} />
              </span>
              {t("legendMine")}
            </span>
          ) : null}
        </p>
      </div>
      {hasMine && !mineFits ? <p className="mt-2 text-sm font-medium text-danger">{t("mineNotListed")}</p> : null}

      <div className="mt-4 border-t-2 border-foreground">
        {groups.map((group, i) => (
          <details key={group.make} open={i === 0 || group.models.some((m) => m.years.some((y) => mine.has(`${group.make}|${m.model}|${y}`)))} className="group border-b border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-lg font-bold uppercase tracking-wide">{group.make}</span>
              <span className="tag-mono text-muted">{t("models", { count: group.models.length })}</span>
            </summary>
            <div className="relative overflow-x-auto pb-4">
              <table className="w-full min-w-max border-collapse text-left">
                <caption className="sr-only">{group.make}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-[1] bg-background px-0 py-1.5 pr-4 text-left">
                      <span className="sr-only">{t("model")}</span>
                    </th>
                    {years.map((y) => (
                      <th key={y} scope="col" className="mono px-0 py-1.5 text-center text-[0.6875rem] font-medium text-muted">
                        {String(y).slice(-2)}
                        <span className="sr-only">{y}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.models.map((m) => (
                    <tr key={m.model} className="border-t border-border">
                      <th scope="row" className="sticky left-0 z-[1] min-w-40 bg-background py-2 pr-4 text-left align-middle">
                        <span className="block text-[0.9375rem] font-semibold">{m.model}</span>
                        {m.engines.length ? <span className="tag-mono block max-w-56 truncate normal-case tracking-normal text-subtle">{m.engines.join(" · ")}</span> : null}
                      </th>
                      {years.map((y) => {
                        const fits = m.years.includes(y);
                        const yours = fits && mine.has(`${group.make}|${m.model}|${y}`);
                        return (
                          <td key={y} className="p-[3px] text-center align-middle">
                            <span
                              className={cn(
                                "mx-auto flex size-6 items-center justify-center sm:size-7",
                                yours ? "bg-primary text-primary-foreground outline outline-2 outline-offset-1 outline-foreground" : fits ? "bg-secondary" : "bg-surface-sunken/60",
                              )}
                            >
                              {yours ? <Check className="size-4" strokeWidth={3.5} aria-hidden /> : null}
                              <span className="sr-only">{yours ? t("cellMine", { year: y }) : fits ? t("cellFits", { year: y }) : t("cellNo", { year: y })}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      {allYears.length > MAX_YEARS ? <p className="tag-mono mt-3 text-subtle">{t("recentYearsOnly", { count: MAX_YEARS })}</p> : null}
    </div>
  );
}
