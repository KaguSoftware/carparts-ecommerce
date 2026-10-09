import "server-only";
import { getProductSummaries } from "@/lib/services/catalog";
import type { ProductSummary } from "@/lib/types/domain";
import type { StoreContext } from "./context";

/**
 * Adds `fitsSelectedVehicle` to summaries that came from services without a vehicle option (featured, deals, new
 * arrivals ...). No-op when nothing is saved in My Garage.
 */
export async function withFitFlags(products: ProductSummary[], ctx: StoreContext): Promise<ProductSummary[]> {
  if (!ctx.hasVehicle || products.length === 0) return products;
  const flagged = await getProductSummaries(
    products.map((p) => p.id),
    { vehicle: ctx.vehicle },
  );
  const byId = new Map(flagged.map((p) => [p.id, p.fitsSelectedVehicle]));
  return products.map((p) => {
    const fits = byId.get(p.id);
    return fits === undefined ? p : { ...p, fitsSelectedVehicle: fits };
  });
}
