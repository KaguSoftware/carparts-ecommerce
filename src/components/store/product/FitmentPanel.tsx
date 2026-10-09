import { getTranslations } from "next-intl/server";
import { CarFront, CircleCheck, CircleHelp, CircleX, Globe } from "lucide-react";
import { localize } from "@/lib/i18n-string";
import { checkFitment } from "@/lib/services/vehicles";
import type { StoreContext } from "../shared/context";
import { VehicleSelector } from "../vehicle/VehicleSelector";
import { cn } from "@/lib/utils";

/**
 * Fitment checker for the product page. Uses the vehicle saved in My Garage; without one it offers the selector inline
 * (saving there also filters the rest of the store).
 */
export async function FitmentPanel({ productId, ctx }: { productId: string; ctx: StoreContext }) {
  const t = await getTranslations("store.fitment");
  const result = ctx.hasVehicle ? await checkFitment(productId, ctx.vehicle) : null;

  const tone = result?.status === "fits" ? "success" : result?.status === "does_not_fit" ? "danger" : result?.status === "universal" ? "success" : "neutral";
  const Icon = result?.status === "fits" ? CircleCheck : result?.status === "does_not_fit" ? CircleX : result?.status === "universal" ? Globe : result ? CircleHelp : CarFront;

  let title: string;
  let body: string | undefined;
  if (!result) {
    title = t("checkTitle");
    body = t("checkBody");
  } else if (result.status === "fits") {
    title = t("fitsTitle", { label: ctx.vehicleLabel ?? "" });
    body = result.note ? localize(result.note, ctx.locale) : t("fitsBody");
  } else if (result.status === "does_not_fit") {
    title = t("noFitTitle", { label: ctx.vehicleLabel ?? "" });
    body = t("noFitBody");
  } else if (result.status === "universal") {
    title = t("universalTitle");
    body = t("universalBody");
  } else {
    title = t("unknownTitle");
    body = t("unknownBody");
  }

  return (
    <section aria-labelledby="fitment-heading" className="rounded-md border border-border bg-surface">
      <div
        className={cn(
          "flex items-start gap-3.5 rounded-t-md px-4 py-4 sm:px-5",
          tone === "success" && "bg-success-soft text-success",
          tone === "danger" && "bg-danger-soft text-danger",
          tone === "neutral" && "bg-surface-sunken text-foreground",
        )}
      >
        <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div>
          <h2 id="fitment-heading" className="font-sans text-[1.0625rem] font-bold normal-case leading-snug tracking-normal">
            {title}
          </h2>
          {body ? <p className="mt-1 text-[0.9375rem] text-foreground/85">{body}</p> : null}
        </div>
      </div>
      {result?.status === "universal" ? null : (
        <div className="px-4 py-4 sm:px-5">
          {ctx.hasVehicle ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-[0.9375rem] font-semibold text-primary-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">{t("changeVehicle")}</summary>
              <div className="pt-4">
                <VehicleSelector idPrefix="pdp-change" initial={ctx.vehicle} submitLabel={t("update")} />
              </div>
            </details>
          ) : (
            <VehicleSelector idPrefix="pdp" submitLabel={t("check")} />
          )}
        </div>
      )}
    </section>
  );
}
