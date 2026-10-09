import "server-only";
import { db } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/services/contracts";
import type { Id, Payment } from "@/lib/types/domain";

export function getProvider(): PaymentProvider {
  return getPaymentProvider();
}

export async function getPaymentForOrder(orderId: Id): Promise<Payment | null> {
  return db.payments.findOne((p) => p.orderId === orderId);
}
