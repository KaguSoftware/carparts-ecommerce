"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { assertUser } from "@/lib/auth/session";
import { signOutCurrentUser } from "@/lib/auth/credentials";
import { revalidateAccount, revalidateStore } from "@/lib/cache";
import { DomainError } from "@/lib/errors";
import { deleteAccount, updateProfile } from "@/lib/services/accounts";
import { redirect } from "@/i18n/navigation";
import { deleteAccountSchema, updateProfileSchema } from "./profile.schema";

export async function updateProfileAction(raw: unknown): Promise<ActionResult> {
  return runAction(updateProfileSchema, raw, async (input) => {
    const user = await assertUser();
    await updateProfile(user.id, { name: input.name, phone: input.phone || null, locale: input.locale, marketingOptIn: input.marketingOptIn });
    revalidateAccount();
    revalidateStore();
  });
}

/** Self-service deletion: customers only (staff accounts are removed by an administrator), confirmed by retyping the email. */
export async function deleteAccountAction(raw: unknown): Promise<ActionResult> {
  return runAction(deleteAccountSchema, raw, async ({ confirmEmail, locale }) => {
    const user = await assertUser();
    if (user.role !== "customer") throw new DomainError("forbidden", { status: 403 });
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new DomainError("validation_failed", { fieldErrors: { confirmEmail: ["invalid_value"] } });
    }
    await deleteAccount(user.id);
    await signOutCurrentUser();
    revalidateStore();
    redirect({ href: "/", locale });
  });
}
