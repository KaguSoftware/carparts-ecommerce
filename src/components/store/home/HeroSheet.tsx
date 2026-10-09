import { getTranslations } from "next-intl/server";
import { ArrowRight, CarFront } from "lucide-react";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getProductBySlug } from "@/lib/services/catalog";
import type { Product } from "@/lib/types/domain";
import type { StoreContext } from "../shared/context";
import { VehicleSelector } from "../vehicle/VehicleSelector";

/** The part the hero is drawn around: the vented brake disc pair. Falls back to generic copy if it is ever removed. */
const FEATURED_SLUG = "veloxa-rotormax-vented-brake-disc-pair";

function specValue(product: Product | undefined, pattern: RegExp): string | undefined {
  return product?.specs.find((s) => pattern.test(s.key.en))?.value.en;
}
const firstNumber = (v: string | undefined) => v?.match(/\d+(?:[.,]\d+)?/)?.[0];

/**
 * Exploded view of the featured part: disc in front elevation (left), then disc, pad pair and caliper along one
 * axis in side elevation (right). Numbered bubbles match the legend below. The linework draws itself once on load
 * (pathLength-normalised stroke-dashoffset), then the callouts tick in; reduced motion shows the finished sheet.
 */
function DiscDrawing({ labels }: { labels: { diameter: string; thickness: string; bolts: string } }) {
  const fx = 172;
  const fy = 214;
  const bolts = Array.from({ length: 5 }, (_, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return [fx + 46 * Math.cos(a), fy + 46 * Math.sin(a)] as const;
  });
  const vents = Array.from({ length: 24 }, (_, i) => {
    const a = ((i * 15 + 7.5) * Math.PI) / 180;
    return [fx + 104 * Math.cos(a), fy + 104 * Math.sin(a), fx + 134 * Math.cos(a), fy + 134 * Math.sin(a)] as const;
  });
  const draw = (delay: number) => ({ animationDelay: `${delay}ms` });
  const ink = "stroke-sheet-ink";
  return (
    <svg viewBox="0 0 700 440" role="img" aria-labelledby="hero-drawing-title" className="block h-auto w-full">
      <title id="hero-drawing-title">{`${labels.diameter}, ${labels.thickness}, ${labels.bolts}`}</title>
      {/* centrelines */}
      <g className="tick-in" style={draw(900)} fill="none" strokeWidth="1.1" strokeDasharray="22 5 3 5">
        <line x1={fx - 168} y1={fy} x2={fx + 168} y2={fy} className="stroke-sheet-accent" />
        <line x1={fx} y1={fy - 168} x2={fx} y2={fy + 168} className="stroke-sheet-accent" />
        <line x1="338" y1={fy} x2="688" y2={fy} className="stroke-sheet-accent" />
      </g>

      {/* front elevation */}
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <circle cx={fx} cy={fy} r="140" pathLength="1" className={`draw-in fill-white ${ink}`} strokeWidth="2.6" style={draw(0)} />
        <circle cx={fx} cy={fy} r="100" pathLength="1" className={`draw-in ${ink}`} strokeWidth="1.2" style={draw(250)} />
        <circle cx={fx} cy={fy} r="118" pathLength="1" className="draw-in stroke-sheet-accent" strokeWidth="2.2" style={draw(350)} />
        <circle cx={fx} cy={fy} r="70" pathLength="1" className={`draw-in ${ink}`} strokeWidth="2.4" style={draw(500)} />
        <circle cx={fx} cy={fy} r="20" pathLength="1" className={`draw-in fill-sheet-faint ${ink}`} strokeWidth="2.4" style={draw(650)} />
        {bolts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="8" pathLength="1" className={`draw-in fill-sheet-faint ${ink}`} strokeWidth="2.2" style={draw(700 + i * 60)} />
        ))}
        {vents.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} pathLength="1" className="draw-in stroke-sheet-muted" strokeWidth="1" style={draw(300 + i * 18)} />
        ))}
      </g>

      {/* side elevation, exploded along the axis */}
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        {/* disc: two faces with vanes between them, and the hat */}
        <g>
          <rect x="396" y="74" width="26" height="280" pathLength="1" className={`draw-in fill-white ${ink}`} strokeWidth="2.4" style={draw(500)} />
          <line x1="404.5" y1="74" x2="404.5" y2="354" pathLength="1" className="draw-in stroke-sheet-muted" strokeWidth="1" style={draw(650)} />
          <line x1="413.5" y1="74" x2="413.5" y2="354" pathLength="1" className="draw-in stroke-sheet-muted" strokeWidth="1" style={draw(700)} />
          <rect x="422" y="154" width="40" height="120" pathLength="1" className={`draw-in fill-white ${ink}`} strokeWidth="2.4" style={draw(750)} />
          <line x1="422" y1="196" x2="462" y2="196" pathLength="1" className="draw-in stroke-sheet-muted" strokeWidth="1" style={draw(850)} />
          <line x1="422" y1="232" x2="462" y2="232" pathLength="1" className="draw-in stroke-sheet-muted" strokeWidth="1" style={draw(850)} />
        </g>
        {/* pad pair */}
        <rect x="500" y="110" width="12" height="208" pathLength="1" className={`draw-in fill-sheet-faint ${ink}`} strokeWidth="2.4" style={draw(900)} />
        <rect x="520" y="110" width="12" height="208" pathLength="1" className={`draw-in fill-sheet-faint ${ink}`} strokeWidth="2.4" style={draw(950)} />
        <line x1="500" y1="110" x2="500" y2="318" pathLength="1" className="draw-in stroke-sheet-accent" strokeWidth="3" style={draw(1000)} />
        {/* caliper (C-section) */}
        <path d="M 568 82 H 676 V 346 H 568 V 312 H 636 V 116 H 568 Z" pathLength="1" className={`draw-in fill-white ${ink}`} strokeWidth="2.6" style={draw(1000)} />
        <rect x="578" y="168" width="48" height="92" pathLength="1" className="draw-in stroke-sheet-accent" strokeWidth="2.2" style={draw(1150)} />
        {/* exploded connectors */}
        <g strokeWidth="1" strokeDasharray="5 5" className="stroke-sheet-muted tick-in" style={draw(1300)}>
          <line x1="462" y1="154" x2="500" y2="110" />
          <line x1="462" y1="274" x2="500" y2="318" />
          <line x1="532" y1="110" x2="568" y2="116" />
          <line x1="532" y1="318" x2="568" y2="312" />
        </g>
      </g>

      {/* dimension 1: overall diameter */}
      <g className="tick-in" style={draw(1250)} strokeWidth="1.2">
        <line x1={fx - 140} y1={fy + 144} x2={fx - 140} y2={fy + 176} className="stroke-sheet-ink" />
        <line x1={fx + 140} y1={fy + 144} x2={fx + 140} y2={fy + 176} className="stroke-sheet-ink" />
        <line x1={fx - 140} y1={fy + 168} x2={fx - 24} y2={fy + 168} className="stroke-sheet-ink" />
        <line x1={fx + 24} y1={fy + 168} x2={fx + 140} y2={fy + 168} className="stroke-sheet-ink" />
        <path d={`M ${fx - 140} ${fy + 168} l 10 -3.4 v 6.8 Z M ${fx + 140} ${fy + 168} l -10 -3.4 v 6.8 Z`} className="fill-sheet-ink" stroke="none" />
      </g>
      {/* dimension 2: disc thickness */}
      <g className="tick-in" style={draw(1350)} strokeWidth="1.2">
        <line x1="396" y1="40" x2="396" y2="68" className="stroke-sheet-ink" />
        <line x1="422" y1="40" x2="422" y2="68" className="stroke-sheet-ink" />
        <line x1="364" y1="52" x2="396" y2="52" className="stroke-sheet-ink" />
        <line x1="422" y1="52" x2="454" y2="52" className="stroke-sheet-ink" />
        <path d="M 396 52 l -10 -3.4 v 6.8 Z M 422 52 l 10 -3.4 v 6.8 Z" className="fill-sheet-ink" stroke="none" />
      </g>

      {/* bubbles */}
      {[
        { x: fx, y: fy + 168, n: "1", delay: 1450 },
        { x: 476, y: 52, n: "2", delay: 1550 },
        { x: 86, y: 52, n: "3", delay: 1650 },
      ].map((b) => (
        <g key={b.n} className="tick-in" style={draw(b.delay)}>
          <circle cx={b.x} cy={b.y} r="17" className="fill-sheet stroke-sheet-accent" strokeWidth="2.2" />
          <text x={b.x} y={b.y + 6} textAnchor="middle" className="mono fill-sheet-ink" fontSize="17" fontWeight="700">
            {b.n}
          </text>
        </g>
      ))}
      <g className="tick-in" style={draw(1650)}>
        <line x1="99" y1="64" x2={bolts[0]![0]! - 2} y2={bolts[0]![1]! - 3} className="stroke-sheet-ink" strokeWidth="1.2" />
        <circle cx={bolts[0]![0]!} cy={bolts[0]![1]!} r="3.6" className="fill-sheet-accent" />
      </g>
    </svg>
  );
}

export async function HeroSheet({ ctx }: { ctx: StoreContext }) {
  const t = await getTranslations("store.home.hero");
  const tf = await getTranslations("store.home.finder");
  const detail = await getProductBySlug(FEATURED_SLUG);
  const product = detail?.product;

  const diameter = firstNumber(specValue(product, /^diameter$/i));
  const thickness = firstNumber(specValue(product, /^thickness$/i));
  const boltHoles = firstNumber(specValue(product, /^bolt holes$/i));
  const spec = diameter && thickness && boltHoles ? { diameter, thickness, boltHoles } : null;
  const partNumber = product?.partNumber ?? "VEL-BDV831";
  const fits = detail?.fitmentCount ?? 0;

  const labels = {
    diameter: t("dimDiameter", { value: spec?.diameter ?? "280" }),
    thickness: t("dimThickness", { value: spec?.thickness ?? "25" }),
    bolts: t("dimBolts", { count: Number(spec?.boltHoles ?? 5) }),
  };

  return (
    <section aria-labelledby="home-headline" className="relative isolate overflow-hidden bg-inverse text-inverse-foreground">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(to_right,rgb(244_245_247/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(244_245_247/0.045)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="container-page grid gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 lg:py-16">
        <div className="space-y-6">
          <h1 id="home-headline" className="display-1">
            <span className="block whitespace-nowrap">{spec ? t("headlineSpec", { a: spec.diameter, b: spec.thickness, c: spec.boltHoles }) : t("headlineFallback")}</span>
            <span className="block text-primary">{t("headlineTail")}</span>
          </h1>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-inverse-muted">{t("subhead")}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/category/brake-discs" className={buttonStyles({ variant: "primary", size: "lg" })}>
              {t("cta")}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/shop" className="tag-mono inline-flex min-h-11 items-center gap-1.5 text-inverse-foreground underline-offset-4 hover:text-primary hover:underline">
              {t("browse")}
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          <div className="reg-marks sheet-grid relative flex flex-col border border-sheet-line bg-sheet text-sheet-ink [--reg-c:var(--sheet-line)]">
            <div className="px-3 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DiscDrawing labels={labels} />
            </div>
            <ol className="grid gap-x-6 gap-y-1.5 border-t border-sheet-line px-4 py-3 text-[0.8125rem] sm:grid-cols-3 sm:px-6">
              {[labels.diameter, labels.thickness, labels.bolts].map((label, i) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span aria-hidden className="mono inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-sheet-accent text-[0.6875rem] font-bold text-sheet-ink">
                    {i + 1}
                  </span>
                  <span className="mono font-medium">{label}</span>
                </li>
              ))}
            </ol>
            <dl className="grid grid-cols-2 border-t border-sheet-ink text-sheet-ink sm:grid-cols-4">
              <div className="border-sheet-line px-4 py-2.5 sm:border-r">
                <dt className="tag-mono text-sheet-muted">{t("tbDrawing")}</dt>
                <dd className="part-no mt-0.5 text-[0.9375rem]">{partNumber}</dd>
              </div>
              <div className="border-l border-sheet-line px-4 py-2.5 sm:border-l-0 sm:border-r">
                <dt className="tag-mono text-sheet-muted">{t("tbRev")}</dt>
                <dd className="part-no mt-0.5 text-[0.9375rem]">C</dd>
              </div>
              <div className="border-t border-sheet-line px-4 py-2.5 sm:border-r sm:border-t-0">
                <dt className="tag-mono text-sheet-muted">{t("tbScale")}</dt>
                <dd className="part-no mt-0.5 text-[0.9375rem]">1:2</dd>
              </div>
              <div className="border-l border-t border-sheet-line px-4 py-2.5 sm:border-t-0">
                <dt className="tag-mono text-sheet-muted">{t("tbFits")}</dt>
                <dd className="part-no mt-0.5 text-[0.9375rem]">{t("fitsVehicles", { count: fits })}</dd>
              </div>
            </dl>
            {ctx.hasVehicle && ctx.vehicleLabel ? (
              <div className="flex flex-col gap-4 border-t border-sheet-ink bg-sheet px-4 py-4 max-lg:order-first max-lg:border-b max-lg:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <CarFront className="mt-0.5 size-7 shrink-0 text-sheet-accent" aria-hidden />
                  <div>
                    <p className="tag-mono text-sheet-muted">{tf("yourGarage")}</p>
                    <p className="font-display text-[1.375rem] font-semibold uppercase leading-tight">{ctx.vehicleLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/shop" className={buttonStyles({ variant: "primary", size: "md" })}>
                    {tf("shopFitting")}
                    <ArrowRight className="size-5" aria-hidden />
                  </Link>
                  <Link href="/garage" className="inline-flex h-11 items-center border border-sheet-ink px-4 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.06em] transition-colors hover:bg-sheet-ink hover:text-sheet">
                    {tf("changeVehicle")}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="border-t border-sheet-ink max-lg:order-first max-lg:border-b max-lg:border-t-0">
                <h2 className="sr-only">{tf("title")}</h2>
                <p className="tag-mono px-4 pb-2.5 pt-3 text-sheet-muted sm:px-6">{tf("hint")}</p>
                <VehicleSelector idPrefix="finder" layout="plate" submitLabel={tf("submit")} className="[&>div:first-child]:border-x-0 [&>div:first-child]:border-b-0" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
