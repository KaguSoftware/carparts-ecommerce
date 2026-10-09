import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

export const wishlistItemSchema = z.object({ productId: idSchema });
export const emptySchema = z.object({});
