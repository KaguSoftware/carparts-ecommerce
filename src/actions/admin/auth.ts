"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/action-result";
import { signInStaff, signOutCurrentUser } from "@/lib/auth/credentials";
import { setAdminLocale } from "@/lib/session/cookies";
import { revalidateAdmin } from "@/lib/cache";
import { adminLocaleSchema, adminSignInSchema, safeAdminNext } from "./auth.schema";

/** Staff sign-in. On success redirects (a thrown redirect propagates through runAction). */
export async function adminSignInAction(raw: unknown) {
  return runAction(adminSignInSchema, raw, async ({ email, password, next }) => {
    await signInStaff({ email, password });
    redirect(safeAdminNext(next));
  });
}

export async function adminSignOutAction() {
  await signOutCurrentUser();
  redirect("/admin/login");
}

export async function setAdminLocaleAction(raw: unknown) {
  return runAction(adminLocaleSchema, raw, async (locale) => {
    await setAdminLocale(locale);
    revalidateAdmin();
  });
}
