"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { assertUser } from "@/lib/auth/session";
import { revalidateAccount, revalidateStore } from "@/lib/cache";
import { clearWishlist, removeFromWishlist } from "@/lib/services/wishlist";
import { emptySchema, wishlistItemSchema } from "./wishlist.schema";

/** Adding is handled by the storefront (toggleWishlistAction); the account page only needs removal. */
export async function removeWishlistItemAction(raw: unknown): Promise<ActionResult> {
  return runAction(wishlistItemSchema, raw, async ({ productId }) => {
    const user = await assertUser();
    await removeFromWishlist(user.id, productId);
    revalidateAccount();
    revalidateStore();
  });
}

export async function clearWishlistAction(raw: unknown = {}): Promise<ActionResult> {
  return runAction(emptySchema, raw, async () => {
    const user = await assertUser();
    await clearWishlist(user.id);
    revalidateAccount();
    revalidateStore();
  });
}
