import "server-only";
import { db } from "@/lib/db";
import { wasPaid } from "@/lib/order-status";
import type { Cents, DashboardStats, ISODate, Order, OrderStatus, TimeSeriesPoint } from "@/lib/types/domain";
import { round1 } from "./_shared";
import { listLowStock } from "./inventory";

const DAY = 86_400_000;

/** Net revenue of a paid order (what the shop kept). */
const net = (o: Pick<Order, "total" | "refundedTotal">): Cents => Math.max(0, o.total - o.refundedTotal);
const dayKey = (iso: string) => iso.slice(0, 10);

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round1(((current - previous) / previous) * 100);
}

/**
 * Orders "counted" in revenue and order totals are those whose payment was captured at some point
 * (paid, partially refunded, refunded). `byStatus` counts EVERY order created in the range so staff also see
 * pending and failed attempts.
 */
export async function getDashboardStats(opts: { days?: 7 | 30 | 90 | 365 } = {}): Promise<DashboardStats> {
  const days = opts.days ?? 30;
  const now = new Date();
  const to = now.getTime();
  const from = to - days * DAY;
  const prevFrom = from - days * DAY;

  const [orders, users] = await Promise.all([db.orders.all(), db.users.find({ where: (u) => u.role === "customer" })]);
  const inRange = orders.filter((o) => Date.parse(o.createdAt) >= from && Date.parse(o.createdAt) <= to);
  const inPrev = orders.filter((o) => Date.parse(o.createdAt) >= prevFrom && Date.parse(o.createdAt) < from);
  const counted = inRange.filter((o) => wasPaid(o.paymentStatus));
  const countedPrev = inPrev.filter((o) => wasPaid(o.paymentStatus));

  const revenue = counted.reduce((s, o) => s + net(o), 0);
  const prevRevenue = countedPrev.reduce((s, o) => s + net(o), 0);

  const byStatus = { pending_payment: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 } as Record<OrderStatus, number>;
  for (const o of inRange) byStatus[o.status]++;

  // zero-filled daily series
  const buckets = new Map<string, TimeSeriesPoint>();
  for (let t = from; t <= to; t += DAY) {
    const key = dayKey(new Date(t).toISOString());
    buckets.set(key, { date: key, revenue: 0, orders: 0 });
  }
  for (const o of counted) {
    const b = buckets.get(dayKey(o.createdAt));
    if (b) {
      b.revenue += net(o);
      b.orders += 1;
    }
  }

  // top products by units (net of refunds), tie-break by revenue
  const products = new Map<string, { productId: string; name: Order["items"][number]["name"]; sku: string; unitsSold: number; revenue: Cents }>();
  for (const o of counted) {
    for (const i of o.items) {
      const units = i.quantity - i.refundedQuantity;
      if (units <= 0) continue;
      const row = products.get(i.productId) ?? { productId: i.productId, name: i.name, sku: i.sku, unitsSold: 0, revenue: 0 };
      row.unitsSold += units;
      row.revenue += Math.round(((i.lineTotal + i.tax) * units) / i.quantity);
      products.set(i.productId, row);
    }
  }
  const topProducts = [...products.values()].sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue).slice(0, 5);

  const [lowStock, pendingReviews, newMessages] = await Promise.all([
    listLowStock({ limit: 8 }),
    db.reviews.count((r) => r.status === "pending"),
    db.contactMessages.count((m) => m.status === "new"),
  ]);

  const recentOrders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  return {
    range: { from: new Date(from).toISOString(), to: now.toISOString(), days },
    revenue: { total: revenue, previous: prevRevenue, changePct: pct(revenue, prevRevenue) },
    orders: { total: counted.length, previous: countedPrev.length, changePct: pct(counted.length, countedPrev.length), byStatus },
    customers: { total: users.length, new: users.filter((u) => Date.parse(u.createdAt) >= from).length },
    averageOrderValue: counted.length ? Math.round(revenue / counted.length) : 0,
    series: [...buckets.values()],
    topProducts,
    lowStock: lowStock.map((l) => ({ variantId: l.variantId, productId: l.productId, sku: l.sku, name: l.productName, available: l.available, threshold: l.threshold })),
    pendingReviews,
    newMessages,
    recentOrders,
  };
}

function periodKey(iso: string, groupBy: "day" | "week" | "month"): string {
  if (groupBy === "day") return iso.slice(0, 10);
  if (groupBy === "month") return iso.slice(0, 7);
  const d = new Date(iso);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek));
  return monday.toISOString().slice(0, 10);
}

export async function getSalesReport(opts: { from: ISODate; to: ISODate; groupBy: "day" | "week" | "month" }) {
  const from = Date.parse(opts.from);
  const to = Date.parse(opts.to);
  const orders = await db.orders.find({ where: (o) => wasPaid(o.paymentStatus) && Date.parse(o.createdAt) >= from && Date.parse(o.createdAt) <= to });
  const groups = new Map<string, { revenue: Cents; orders: number; units: number }>();
  for (const o of orders) {
    const key = periodKey(o.createdAt, opts.groupBy);
    const g = groups.get(key) ?? { revenue: 0, orders: 0, units: 0 };
    g.revenue += net(o);
    g.orders += 1;
    g.units += o.items.reduce((s, i) => s + (i.quantity - i.refundedQuantity), 0);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, g]) => ({ period, revenue: g.revenue, orders: g.orders, units: g.units, averageOrderValue: g.orders ? Math.round(g.revenue / g.orders) : 0 }));
}
