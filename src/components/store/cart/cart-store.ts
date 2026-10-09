import { useSyncExternalStore } from "react";
import { getCartAction } from "@/actions/store/cart";
import type { CartView } from "@/lib/types/domain";

/**
 * Tiny external store for the visitor's cart so the header badge, the drawer, product pages and the cart page
 * stay in sync without a provider (the header is mounted by several layouts). Client-only module.
 * The server remains the source of truth: every mutation returns a fresh `CartView` that lands here.
 */
interface CartState {
  cart: CartView | null;
  /** Variant that was just added: its part plate plays the stamp animation once. */
  justAdded: string | null;
  open: boolean;
  loading: boolean;
}

const SERVER_STATE: CartState = { cart: null, justAdded: null, open: false, loading: false };
let state: CartState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<CartState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const cartStore = {
  getState: () => state,
  setCart(cart: CartView | null) {
    set({ cart });
  },
  flashAdded(variantId: string) {
    set({ justAdded: variantId });
    setTimeout(() => {
      if (state.justAdded === variantId) set({ justAdded: null });
    }, 1600);
  },
  openDrawer() {
    set({ open: true });
  },
  closeDrawer() {
    set({ open: false });
  },
  /** Reload from the server (drawer open, after sign-in...). */
  async refresh() {
    set({ loading: true });
    try {
      set({ cart: await getCartAction(), loading: false });
    } catch {
      set({ loading: false });
    }
  },
  /** Called with the server-rendered item count: drop a stale client cart that no longer matches. */
  syncServerCount(count: number) {
    if (state.cart && state.cart.totals.itemCount !== count) set({ cart: null });
  },
};

export function useCartStore(): CartState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
