import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, toActor } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { Actor, Permission, SessionUser } from "@/lib/types/domain";

/**
 * Page-level authorisation for admin server components. Signed out -> login, customers -> the shell's
 * "no access" screen, missing permission -> dashboard with a notice. (Actions re-check with `assertStaff`.)
 */
export async function guard(permission: Permission): Promise<{ user: SessionUser; actor: Actor }> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "customer") redirect("/admin/login");
  if (!can(user.role, permission)) redirect("/admin?denied=1");
  return { user, actor: toActor(user) };
}
