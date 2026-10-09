"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { assertUser } from "@/lib/auth/session";
import { revalidateAccount } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { toggleWishlist } from "@/lib/services/wishlist";
import { idSchema } from "@/lib/validation/common";

const schema = z.object({ productId: idSchema });

export async function toggleWishlistAction(raw: unknown): Promise<ActionResult<{ inWishlist: boolean; count: number }>> {
  return runAction(schema, raw, async ({ productId }) => {
    const user = await assertUser();
    await enforceRateLimit("wishlist", { limit: 60, windowMs: 60_000, discriminator: user.id });
    const result = await toggleWishlist(user.id, productId);
    revalidateAccount();
    return result;
  });
}
