"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { assertUser } from "@/lib/auth/session";
import { revalidateAccount } from "@/lib/cache";
import { createAddress, deleteAddress, updateAddress } from "@/lib/services/accounts";
import { addressIdSchema, saveAddressSchema, setDefaultAddressSchema } from "./addresses.schema";

/** Create (no `id`) or update (with `id`) one of the signed-in user's addresses. Ownership is enforced by the service. */
export async function saveAddressAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(saveAddressSchema, raw, async ({ id, isDefaultShipping, isDefaultBilling, ...fields }) => {
    const user = await assertUser();
    const saved = id
      ? await updateAddress(user.id, id, { ...fields, isDefaultShipping, isDefaultBilling })
      : await createAddress(user.id, { ...fields, isDefaultShipping, isDefaultBilling });
    revalidateAccount();
    return { id: saved.id };
  });
}

export async function deleteAddressAction(raw: unknown): Promise<ActionResult> {
  return runAction(addressIdSchema, raw, async ({ id }) => {
    const user = await assertUser();
    await deleteAddress(user.id, id);
    revalidateAccount();
  });
}

export async function setDefaultAddressAction(raw: unknown): Promise<ActionResult> {
  return runAction(setDefaultAddressSchema, raw, async ({ id, kind }) => {
    const user = await assertUser();
    await updateAddress(user.id, id, kind === "shipping" ? { isDefaultShipping: true } : { isDefaultBilling: true });
    revalidateAccount();
  });
}
