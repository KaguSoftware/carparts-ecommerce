import type { CurrencyContext } from "@/lib/money";
import type { Order } from "@/lib/types/domain";

/** The currency an order was charged in, frozen at placement (orders never re-convert with today's rate). */
export function orderCurrency(order: Pick<Order, "currency" | "fxRate">): CurrencyContext {
  return { currency: order.currency, rate: order.fxRate };
}

/** Localised country name for an ISO alpha-2 code ("DE" -> "Germany" / "Almanya"). Falls back to the code. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
