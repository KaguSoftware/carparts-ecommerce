import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CarFront, Fuel } from "lucide-react";
import { Breadcrumbs, buttonStyles } from "@/components/ui";
import { getStoreContext } from "@/components/store/shared/context";
import { pageMetadata } from "@/components/store/shared/seo";
import { ClearVehicleButton } from "@/components/store/vehicle/ClearVehicleButton";
import { VehicleSelector } from "@/components/store/vehicle/VehicleSelector";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { getCategoryTree, listProducts } from "@/lib/services/catalog";
import { getVehicle } from "@/lib/services/vehicles";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.garage" });
  return pageMetadata({ locale, path: "/garage", title: t("metaTitle"), description: t("metaDescription"), noindex: true });
}

export default async function GaragePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("store.garage");
  const tVehicle = await getTranslations("store.vehicle");
  const ctx = await getStoreContext(locale);

  const exact = ctx.vehicle.vehicleId ? await getVehicle(ctx.vehicle.vehicleId) : null;
  const [tree, fitting] = ctx.hasVehicle
    ? await Promise.all([getCategoryTree(), listProducts({ vehicle: ctx.vehicle, pageSize: 1, locale })])
    : [[], null];
  const counts = new Map(fitting?.facets.categories.map((c) => [c.id, c.count]) ?? []);
  const categories = tree
    .map((c) => ({ slug: c.slug, name: localize(c.name, locale), count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      <h1 className="display-2 mb-2 mt-6">{t("title")}</h1>
      <p className="max-w-2xl text-[1.0625rem] text-muted">{t("intro")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <section aria-labelledby="garage-vehicle">
          {ctx.hasVehicle && ctx.vehicleLabel ? (
            <>
              <h2 id="garage-vehicle" className="display-3">
                {t("savedTitle")}
              </h2>
              <div className="mt-5 flex items-start gap-4 border-y border-border py-6">
                <CarFront className="mt-1 size-10 shrink-0 text-primary-text" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0">
                  <p className="font-display text-3xl font-bold uppercase leading-tight">{ctx.vehicleLabel}</p>
                  {exact ? (
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9375rem] text-muted">
                      <span>{exact.engine}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Fuel className="size-4" aria-hidden />
                        {t(`fuel.${exact.fuel}`)}
                      </span>
                      {exact.bodyType ? <span>{exact.bodyType}</span> : null}
                    </p>
                  ) : (
                    <p className="mt-2 text-[0.9375rem] text-muted">{t("partialHint")}</p>
                  )}
                  {fitting ? <p className="num mt-3 font-semibold">{t("fittingCount", { count: fitting.total })}</p> : null}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/shop" className={buttonStyles({ variant: "primary", size: "lg" })}>
                  {t("shopFitting")}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <ClearVehicleButton />
              </div>
              {categories.length > 0 ? (
                <div className="mt-10">
                  <h3 className="display-4">{t("byCategory")}</h3>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/category/${c.slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 font-medium transition-colors hover:border-border-strong hover:text-primary-text">
                          {c.name}
                          <span className="num text-[0.8125rem] text-subtle">{c.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 id="garage-vehicle" className="display-3">
                {t("emptyTitle")}
              </h2>
              <p className="mt-3 max-w-md text-muted">{t("emptyBody")}</p>
              <ul className="mt-6 space-y-3 text-[0.9375rem]">
                {(["benefit1", "benefit2", "benefit3"] as const).map((k) => (
                  <li key={k} className="flex items-start gap-3">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="garage-select" className="rounded-md border border-border bg-surface p-5 sm:p-7">
          <h2 id="garage-select" className="display-3">
            {ctx.hasVehicle ? t("changeTitle") : t("selectTitle")}
          </h2>
          <p className="mb-5 mt-1 text-sm text-muted">{tVehicle("dialogDescription")}</p>
          <VehicleSelector idPrefix="garage" initial={ctx.vehicle} />
        </section>
      </div>
    </div>
  );
}
