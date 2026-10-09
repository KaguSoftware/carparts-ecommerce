import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Revalidation helpers for Server Actions (ARCHITECTURE.md > Server Actions). Services never call these.
 * Pages that read cookies are dynamic anyway; these keep any cached segments (route cache, prefetch) honest.
 */

/** Everything under the storefront (catalog, cart badges, CMS pages ...). */
export function revalidateStore(): void {
  revalidatePath("/[locale]", "layout");
}

/** The admin panel; pass a path to be precise (e.g. "/admin/products"). */
export function revalidateAdmin(path?: string): void {
  if (path) revalidatePath(path);
  else revalidatePath("/admin", "layout");
}

/** Signed-in customer pages (orders, addresses, wishlist, profile). */
export function revalidateAccount(): void {
  revalidatePath("/[locale]/account", "layout");
}
