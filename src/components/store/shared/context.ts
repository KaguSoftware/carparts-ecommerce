import "server-only";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import type { CurrencyContext } from "@/lib/money";
import { getCurrencyContext } from "@/lib/services/settings";
import { describeSelection } from "@/lib/services/vehicles";
import { getWishlistIds } from "@/lib/services/wishlist";
import { getVehicleSelection } from "@/lib/session/cookies";
import type { SessionUser, VehicleSelection } from "@/lib/types/domain";

export interface StoreContext {
  locale: Locale;
  currency: CurrencyContext;
  user: SessionUser | null;
  /** Verified "My Garage" selection (empty object when none / no longer valid). */
  vehicle: VehicleSelection;
  vehicleLabel: string | null;
  hasVehicle: boolean;
  wishlistIds: ReadonlySet<string>;
}

/**
 * Everything a storefront render needs that depends on the visitor (not just the URL).
 * Cached per request so the layout, page and sections share one lookup.
 */
export const getStoreContext = cache(async (locale: Locale): Promise<StoreContext> => {
  const [currency, user, rawVehicle] = await Promise.all([getCurrencyContext(locale), getSessionUser(), getVehicleSelection()]);
  const hasRaw = Boolean(rawVehicle.makeId || rawVehicle.modelId || rawVehicle.vehicleId);
  const label = hasRaw ? await describeSelection(rawVehicle) : null;
  const wishlist = user ? await getWishlistIds(user.id) : [];
  return {
    locale,
    currency,
    user,
    vehicle: label ? rawVehicle : {},
    vehicleLabel: label,
    hasVehicle: Boolean(label),
    wishlistIds: new Set(wishlist),
  };
});
