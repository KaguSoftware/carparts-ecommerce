"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowUpRight, Box, ChevronDown } from "lucide-react";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BlueprintFallback, type BlueprintLabels } from "./BlueprintFallback";
import { partHref, partNumber, PARTS, PART_BY_ID, PART_IDS, type PartId, type StageBridge } from "./parts";
import { useEngineEnv } from "./use-engine-env";

/**
 * Full-width "Engine teardown" section for the storefront home page.
 *
 * Loading order: the SVG blueprint is server-rendered and painted with the page. The three.js stage is a separate chunk
 * (next/dynamic, ssr:false) that is only requested once the section is within ~600px of the viewport, so it never competes
 * with LCP. When motion is reduced, the device looks weak, data saver is on or WebGL is missing, the blueprint stays and
 * 3D is offered on request (or not at all without WebGL).
 */

const EngineStage = dynamic(() => import("./EngineStage"), { ssr: false });

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The rectangle the engine (or its blueprint) is drawn into, inside the stage wrapper. It is the same on every breakpoint:
 * clear of the 18rem legend on the right (the wrapper stops at `md:right-72`), clear of the bottom bar (rail, hint and
 * disclaimer take about 6.5rem, reserved as `md:bottom-[7.5rem]`), and below the headline on md, beside it from lg up (the headline
 * column is 26rem wide). The stage fills the rest, so nothing here ever runs under copy or under the rail.
 */
const FIT_REGION = "md:bottom-[7.5rem] md:left-2 md:right-2 md:top-[15rem] lg:left-[27rem] lg:top-4";

type Mode = "scroll" | "manual" | "static";

export function EngineTeardown() {
  const t = useTranslations("engine3d");
  const env = useEngineEnv();

  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const bridge = useRef<StageBridge>({ progress: 0, invalidate: null });
  const pinned = useRef(false);
  const clearTimer = useRef<number | undefined>(undefined);
  const switchTimer = useRef<number | undefined>(undefined);
  const pending = useRef<PartId | null>(null);
  const activeRef = useRef<PartId | null>(null);

  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActiveState] = useState<PartId | null>(null);
  const [shown, setShown] = useState<PartId>("cylinderHead");
  const [manual, setManual] = useState(0.7);

  const autoOk = env.known && env.webgl && !env.reducedMotion && !env.lowPower;
  const mode: Mode = failed ? "static" : autoOk ? "scroll" : env.known && env.webgl && optIn ? "manual" : "static";
  // Until the client has measured the device, lay the section out for the common case (scroll mode) so hydration does not reflow it.
  const layout: Mode = env.known ? mode : "scroll";
  const showStage = env.known && mode !== "static" && near && !failed;
  const paused = !visible || tabHidden;
  const threeLive = showStage && ready;

  const names = Object.fromEntries(PART_IDS.map((id) => [id, t(`parts.${id}.name`)])) as Record<PartId, string>;
  const blueprint: BlueprintLabels = { names, ariaLabel: t("blueprintLabel") };

  /* ------------------------------------------------------------ hover / selection */

  const setActive = useCallback((id: PartId | null) => {
    activeRef.current = id;
    pending.current = null;
    window.clearTimeout(switchTimer.current);
    setActiveState(id);
    if (id) setShown(id);
  }, []);
  const cancelClear = useCallback(() => {
    window.clearTimeout(clearTimer.current);
  }, []);
  const scheduleClear = useCallback(() => {
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      if (!pinned.current) setActive(null);
    }, 320);
  }, [setActive]);

  const onHover = useCallback(
    (id: PartId | null) => {
      if (id) {
        cancelClear();
        if (pinned.current) return;
        const current = activeRef.current;
        if (!current || current === id) setActive(id);
        else if (pending.current !== id) {
          // Another part is under the pointer while a card is open: wait a beat, so sweeping across neighbours on the way
          // to the card does not keep swapping the selection.
          pending.current = id;
          window.clearTimeout(switchTimer.current);
          switchTimer.current = window.setTimeout(() => setActive(id), 140);
        }
      } else {
        pending.current = null;
        window.clearTimeout(switchTimer.current);
        scheduleClear();
      }
    },
    [cancelClear, scheduleClear, setActive],
  );
  const onSelect = useCallback(
    (id: PartId) => {
      cancelClear();
      pinned.current = true;
      setActive(id);
    },
    [cancelClear, setActive],
  );
  const onMiss = useCallback(() => {
    cancelClear();
    pinned.current = false;
    setActive(null);
  }, [cancelClear, setActive]);
  /** Legend and blueprint hover always win over a pinned canvas selection. */
  const onLegend = useCallback(
    (id: PartId | null) => {
      cancelClear();
      pinned.current = false;
      setActive(id);
    },
    [cancelClear, setActive],
  );

  useEffect(
    () => () => {
      window.clearTimeout(clearTimer.current);
      window.clearTimeout(switchTimer.current);
    },
    [],
  );

  /* ------------------------------------------------------------ visibility */

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "600px 0px" },
    );
    const visibleObserver = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0 });
    nearObserver.observe(el);
    visibleObserver.observe(el);
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      nearObserver.disconnect();
      visibleObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* ------------------------------------------------------------ progress */

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const push = (p: number) => {
      bridge.current.progress = p;
      el.style.setProperty("--engine-p", p.toFixed(4));
      bridge.current.invalidate?.();
    };

    if (mode === "manual") {
      push(manual);
      return;
    }
    if (mode !== "scroll") {
      el.style.setProperty("--engine-p", "1");
      return;
    }

    const phoneQuery = window.matchMedia("(max-width: 767px)");
    const rootFontSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    let raf = 0;
    const update = () => {
      raf = 0;
      const header = document.querySelector<HTMLElement>("header.sticky");
      // On phones the header slides its search row away while this section is pinned (see HeaderAutoHide), so the stage starts
      // below the compact header and the model gets that height back.
      const lifted = phoneQuery.matches ? parseFloat(header ? getComputedStyle(header).getPropertyValue("--search-hide") : "") * rootFontSize() : 0;
      const top = Math.round((header?.getBoundingClientRect().height ?? 68) - (Number.isFinite(lifted) ? lifted : 0));
      el.style.setProperty("--engine-top", `${top}px`);
      const rect = el.getBoundingClientRect();
      const travel = rect.height - (window.innerHeight - top);
      const raw = travel > 0 ? (top - rect.top) / travel : 0;
      // Dwell assembled for the first 8 percent and exploded for the last 12 percent of the section.
      push(clamp01((raw - 0.08) / 0.8));
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode, manual]);

  // While the scroll-driven stage is on screen, ask the header (phones) to keep its search row tucked away.
  const compactHeader = mode === "scroll" && visible;
  useEffect(() => {
    if (!compactHeader) return;
    const root = document.documentElement;
    root.setAttribute("data-header-compact", "");
    return () => root.removeAttribute("data-header-compact");
  }, [compactHeader]);

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  /* ------------------------------------------------------------ pieces */

  const tag = PART_BY_ID[shown];
  // The headline instruction must match what the mode can actually do: only scroll mode explodes on scroll.
  const bodyKey = layout === "scroll" ? "body" : layout === "manual" ? "bodyManual" : "bodyStatic";
  const optInNote = env.lowPower ? t("optInSaver") : t("optInReduced");

  const legendLink = (id: PartId, className: string) => (
    <Link
      href={partHref(PART_BY_ID[id])}
      onPointerEnter={() => onLegend(id)}
      onPointerLeave={() => onLegend(null)}
      onFocus={() => onLegend(id)}
      onBlur={() => onLegend(null)}
      className={cn(className, active === id && "bg-inverse-surface text-primary")}
    >
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span aria-hidden className={cn("tag-mono w-[1.375rem] shrink-0 transition-colors", active === id ? "text-primary" : "text-inverse-muted/70")}>
          {partNumber(id)}
        </span>
        <span className="truncate">{names[id]}</span>
      </span>
      <ArrowUpRight className={cn("size-4 shrink-0 transition-opacity", active === id ? "opacity-100" : "opacity-0 group-hover:opacity-60")} aria-hidden />
    </Link>
  );

  const partsDetails = (position: string) => (
    <details className={cn("group/list pointer-events-auto md:hidden", position)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm border border-inverse-border bg-inverse-surface px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {t("partsListMobile", { count: PART_IDS.length })}
        <ChevronDown className="size-4 transition-transform group-open/list:rotate-180" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 bottom-full mb-2 max-h-[55svh] overflow-y-auto rounded-sm border border-inverse-border bg-inverse p-2 shadow-lg">
        <ul className="grid grid-cols-2 gap-x-1">
          {PARTS.map((p) => (
            <li key={p.id}>{legendLink(p.id, "group flex min-h-11 items-center justify-between gap-2 rounded-sm px-2 text-sm text-inverse-muted")}</li>
          ))}
        </ul>
        <p className="mt-2 border-t border-inverse-border px-2 pt-2 text-xs leading-snug text-inverse-muted/80">{t("disclaimer")}</p>
      </div>
    </details>
  );

  return (
    <section
      ref={sectionRef}
      id="engine-teardown"
      aria-labelledby="engine-teardown-title"
      data-mode={mode}
      className={cn("relative bg-inverse text-inverse-foreground", layout === "scroll" && "h-[300svh] md:h-[340svh]")}
    >
      <div
        className={cn(
          "relative isolate w-full overflow-hidden",
          layout === "scroll" ? "sticky top-[var(--engine-top,4.25rem)] h-[calc(100svh-var(--engine-top,4.25rem))] min-h-[34rem]" : layout === "static" ? "h-[50rem] md:h-[48rem]" : "h-[44rem] md:h-[48rem]",
        )}
      >
        {/* drafting grid */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_45%,#000_25%,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--inverse-border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--inverse-border) 70%, transparent) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {/* blueprint: painted with the page, fades out once the 3D frame is on screen */}
        <div
          className={cn(
            "absolute inset-x-0 top-[14.5rem] px-4 py-2 transition-opacity duration-700 md:right-72 md:inset-y-0 md:p-0",
            layout === "static" ? "bottom-[13.5rem]" : "bottom-[7.5rem]",
            threeLive ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={threeLive || undefined}
        >
          <div className={cn("absolute inset-x-4 inset-y-2 md:inset-auto", FIT_REGION)}>
            <BlueprintFallback labels={blueprint} activeId={active} onActive={onLegend} className="mx-auto" />
          </div>
        </div>

        {/* 3D stage */}
        {showStage ? (
          <div
            className={cn("absolute inset-x-0 bottom-[7.5rem] top-[14.5rem] transition-opacity duration-700 md:inset-y-0 md:right-72", ready ? "opacity-100" : "opacity-0")}
            style={{ cursor: active ? "pointer" : "grab" }}
          >
            {/* where the model is fitted (the rig reads this rectangle): clear of the headline, the legend and the bottom bar */}
            <div aria-hidden data-fit-bounds className={cn("pointer-events-none absolute inset-0", FIT_REGION)} />
            {/* the area the label card may use: the fit rectangle, widened to the stage's edges so the card has a gutter beside the model */}
            <div aria-hidden data-tag-bounds className="pointer-events-none absolute inset-0 md:bottom-[7.5rem] md:top-[15rem] lg:left-10 lg:top-[21rem]" />
            <div role="img" aria-label={t("canvasLabel")} className="absolute inset-0">
              <EngineStage
                bridge={bridge}
                activeId={active}
                paused={paused}
                coarse={env.coarse}
                labelRef={labelRef}
                onHover={onHover}
                onSelect={onSelect}
                onMiss={onMiss}
                onReady={onReady}
                onFail={onFail}
              />
            </div>
            <div
              ref={labelRef}
              data-anchor="off"
              onPointerEnter={cancelClear}
              onPointerLeave={() => !pinned.current && scheduleClear()}
              className="pointer-events-auto absolute left-0 top-0 z-10 w-60 max-w-[calc(100%-1rem)] rounded-md border border-inverse-border bg-inverse-surface p-3.5 text-inverse-foreground shadow-lg transition-[opacity,visibility] duration-150 data-[anchor=off]:invisible data-[anchor=off]:pointer-events-none data-[anchor=off]:opacity-0"
            >
              {/* leader: drawn by the rig from the card edge to the highlighted part, through the gutter */}
              <svg aria-hidden className="pointer-events-none absolute left-0 top-0 size-px overflow-visible text-primary">
                <line stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
                <circle r="3.5" fill="currentColor" />
              </svg>
              <p className="display-4">{names[shown]}</p>
              <p className="mt-1 text-sm leading-snug text-inverse-muted">{t(`parts.${shown}.note`)}</p>
              <Link href={partHref(tag)} className={buttonStyles({ size: "sm", className: "mt-3" })}>
                {t(`parts.${shown}.shop`)}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        ) : null}

        {/* headline column */}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-5 md:max-w-[26rem] md:p-10">
          <h2 id="engine-teardown-title" className="display-2 text-balance">
            {t("title")}
          </h2>
          <p className="display-4 mt-2 text-primary">{t("subtitle")}</p>
          <p className="mt-3 max-w-[34ch] text-[0.9375rem] leading-relaxed text-inverse-muted md:mt-4 md:max-w-[38ch]">
            <span className="[@media(hover:none)]:hidden">{t(bodyKey)}</span>
            <span className="hidden [@media(hover:none)]:inline">{t(`${bodyKey}Touch` as `${typeof bodyKey}Touch`)}</span>
          </p>
          <Link href="/category/engine" className={buttonStyles({ variant: "outline", size: "sm", className: "pointer-events-auto mt-4 border-inverse-border text-inverse-foreground hover:border-inverse-foreground hover:bg-inverse-surface" })}>
            {t("shopEngine")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {/* legend: every part is a link to its category */}
        <nav aria-label={t("partsList")} className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 items-center p-6 md:flex xl:py-10 xl:pl-6 xl:pr-8">
          <ul className="pointer-events-auto w-full">
            {PARTS.map((p) => (
              <li key={p.id}>{legendLink(p.id, "group flex min-h-8 items-center justify-between gap-3 rounded-sm px-3 py-1 text-[0.9375rem] text-inverse-muted transition-colors hover:bg-inverse-surface hover:text-inverse-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus")}</li>
            ))}
          </ul>
        </nav>

        {/* bottom bar: explode rail, hints, opt-in, disclaimer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 md:p-10 md:pr-[19rem]">
          {mode === "static" ? (
            <div className="pointer-events-auto relative z-30 flex flex-wrap items-center gap-x-4 gap-y-2">
              {env.known && env.webgl && !failed ? (
                <>
                  <button type="button" onClick={() => setOptIn(true)} className={buttonStyles({ size: "sm" })}>
                    <Box className="size-4" aria-hidden />
                    {t("optIn")}
                  </button>
                  <p className="max-w-[44ch] text-sm text-inverse-muted">{optInNote}</p>
                </>
              ) : env.known ? (
                <p className="max-w-[52ch] text-sm text-inverse-muted">{failed ? t("failed") : t("noWebgl")}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {!ready ? (
                <p role="status" className="text-xs text-inverse-muted">
                  {t("loading")}
                </p>
              ) : (
                <p className="hidden shrink-0 text-xs text-inverse-muted transition-opacity sm:block" style={mode === "scroll" ? { opacity: "calc(1.2 - var(--engine-p, 0) * 6)" } : undefined}>
                  {mode === "scroll" ? `${t("hintScroll")} · ` : ""}
                  {t("hintDrag")}
                </p>
              )}
              <div className="pointer-events-auto flex min-w-48 flex-1 items-center gap-3 text-xs text-inverse-muted md:max-w-md">
                <span className="label-caps shrink-0">{t("assembled")}</span>
                {mode === "manual" ? (
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={manual}
                    onChange={(e) => setManual(Number(e.target.value))}
                    aria-label={t("explode")}
                    className="h-6 min-w-0 flex-1 accent-[var(--primary)]"
                  />
                ) : (
                  <span aria-hidden className="relative h-px min-w-0 flex-1 bg-inverse-border">
                    <span className="absolute inset-y-[-1px] left-0 bg-primary" style={{ width: "calc(var(--engine-p, 0) * 100%)", height: "3px" }} />
                    <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: "calc(var(--engine-p, 0) * 100%)" }} />
                  </span>
                )}
                <span className="label-caps shrink-0">{t("exploded")}</span>
              </div>
            </div>
          )}
          {mode === "static" ? partsDetails("relative z-30") : null}
          <p className="hidden max-w-[62ch] text-xs leading-snug text-inverse-muted/80 md:block">{t("disclaimer")}</p>
        </div>

        {/* phones: collapsible parts list (floats above the bar in 3D modes; in static mode it joins the bar's flow, under the opt-in row) */}
        {mode !== "static" ? partsDetails("absolute inset-x-5 bottom-[4.25rem] z-20") : null}
      </div>
    </section>
  );
}
