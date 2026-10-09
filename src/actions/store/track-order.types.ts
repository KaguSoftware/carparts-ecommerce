import type { Currency } from "@/lib/money";
import type { LocalizedString, OrderEvent, OrderStatus, PaymentStatus } from "@/lib/types/domain";

/** What guest order tracking exposes: no tokens, notes, staff identities or full addresses. */
export interface TrackedOrder {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  currency: Currency;
  fxRate: number;
  items: {
    name: LocalizedString;
    variantName: LocalizedString;
    brandName: string;
    image?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  shippingMethod: LocalizedString;
  estimatedDays: { min: number; max: number };
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  destination: { city: string; region: string; country: string };
  timeline: { at: string; type: OrderEvent["type"]; status?: OrderStatus }[];
}
