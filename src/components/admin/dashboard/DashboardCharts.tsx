"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint } from "@/lib/types/domain";

interface Props {
  series: TimeSeriesPoint[];
}

const MONO = "var(--font-mono)";
const AXIS = { fill: "var(--muted)", fontSize: 11, fontFamily: MONO } as const;
const TOOLTIP_STYLE = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: 0,
  fontSize: 12,
  fontFamily: MONO,
  color: "var(--foreground)",
  boxShadow: "var(--shadow-md)",
} as const;

function ChartFrame({ title, summary, legend, children }: { title: string; summary: string; legend?: { color: string; label: string; dashed?: boolean }[]; children: React.ReactNode }) {
  return (
    <figure className="reg-marks min-w-0 border border-border-strong bg-surface p-4" role="group" aria-label={`${title}. ${summary}`}>
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="tag-mono text-foreground">{title}</span>
        <span className="mono text-sm font-semibold text-foreground">{summary}</span>
      </figcaption>
      {/* Millimetre paper under a transparent plot: 8px minor, 40px major hairlines. */}
      <div className="grid-paper h-60 border border-border" aria-hidden>
        {children}
      </div>
      {legend?.length ? (
        <p className="tag-mono mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-muted" aria-hidden>
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-2">
              <span className="inline-block h-0 w-5 border-t-2" style={{ borderColor: l.color, borderStyle: l.dashed ? "dashed" : "solid" }} />
              {l.label}
            </span>
          ))}
        </p>
      ) : null}
    </figure>
  );
}

/**
 * Revenue (stepped line + 7-day mean), orders (bars) and average order value (stepped line) over the selected range.
 * Square-cornered, unsmoothed (daily buckets are not a continuous signal), one primary hue (orange) against graphite.
 * Values are USD cents.
 */
export function DashboardCharts({ series }: Props) {
  const t = useTranslations("admin.dashboard.charts");
  const locale = useLocale();

  const fmt = useMemo(() => {
    const tag = locale === "tr" ? "tr-TR" : "en-US";
    const money = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
    const compact = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
    const day = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", timeZone: "UTC" });
    const dayLong = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone: "UTC" });
    return {
      money: (cents: number) => money.format(cents / 100),
      compact: (cents: number) => compact.format(cents / 100),
      day: (date: string) => day.format(new Date(`${date}T00:00:00Z`)),
      dayLong: (date: string) => dayLong.format(new Date(`${date}T00:00:00Z`)),
    };
  }, [locale]);

  const data = useMemo(
    () =>
      series.map((p, i) => {
        const win = series.slice(Math.max(0, i - 6), i + 1);
        const winOrders = win.reduce((s, x) => s + x.orders, 0);
        return {
          ...p,
          // Rolling 7-day average order value (revenue over orders in the window). A window with no orders has no average at all,
          // so it is null (a gap), never $0: a quiet day must not read as order values collapsing.
          aov: winOrders > 0 ? Math.round(win.reduce((s, x) => s + x.revenue, 0) / winOrders) : null,
          mean7: Math.round(win.reduce((s, x) => s + x.revenue, 0) / win.length),
        };
      }),
    [series],
  );
  const totalRevenue = data.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = data.reduce((s, p) => s + p.orders, 0);
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const xAxis = <XAxis dataKey="date" tickFormatter={fmt.day} tick={AXIS} tickLine={{ stroke: "var(--border-strong)" }} axisLine={{ stroke: "var(--border-strong)" }} interval="preserveStartEnd" minTickGap={56} padding={{ left: 0, right: 16 }} />;
  const grid = <CartesianGrid stroke="var(--border-strong)" strokeOpacity={0.45} />;
  const labelFormatter = (label: unknown) => fmt.dayLong(String(label));
  const initial = { width: 600, height: 240 };
  const margin = { top: 8, right: 12, bottom: 0, left: 0 };
  const yMoney = <YAxis tickFormatter={fmt.compact} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} width={58} />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0 xl:col-span-2">
        <ChartFrame
          title={t("revenue")}
          summary={fmt.money(totalRevenue)}
          legend={[
            { color: "var(--primary)", label: t("revenue") },
            { color: "var(--foreground)", label: t("mean7"), dashed: true },
          ]}
        >
          <ResponsiveContainer width="100%" height="100%" initialDimension={initial}>
            <LineChart data={data} margin={margin}>
              {grid}
              {xAxis}
              {yMoney}
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--foreground)", strokeDasharray: "3 3" }} labelFormatter={labelFormatter} formatter={(v, name) => [fmt.money(Number(v)), name === "mean7" ? t("mean7") : t("revenue")]} />
              <Line type="stepAfter" dataKey="mean7" stroke="var(--foreground)" strokeWidth={1.25} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.25} strokeLinejoin="miter" dot={false} activeDot={{ r: 3, fill: "var(--primary)", stroke: "var(--foreground)", strokeWidth: 1 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <ChartFrame title={t("orders")} summary={String(totalOrders)} legend={[{ color: "var(--primary)", label: t("orders") }]}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={initial}>
          <BarChart data={data} margin={margin} barCategoryGap="12%">
            {grid}
            {xAxis}
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} width={32} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--foreground)", fillOpacity: 0.06 }} labelFormatter={labelFormatter} formatter={(v) => [String(v), t("orders")]} />
            <Bar dataKey="orders" fill="var(--primary)" radius={0} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title={t("aov")}
        summary={fmt.money(aov)}
        legend={[
          { color: "var(--foreground)", label: t("aov7") },
          { color: "var(--primary)", label: t("periodMean"), dashed: true },
        ]}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={initial}>
          <LineChart data={data} margin={margin}>
            {grid}
            {xAxis}
            {yMoney}
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--foreground)", strokeDasharray: "3 3" }} labelFormatter={labelFormatter} formatter={(v) => [fmt.money(Number(v)), t("aov7")]} />
            <ReferenceLine y={aov} stroke="var(--primary)" strokeDasharray="5 4" strokeWidth={1.5} />
            <Line type="stepAfter" dataKey="aov" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="miter" connectNulls dot={false} activeDot={{ r: 3, fill: "var(--foreground)" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
