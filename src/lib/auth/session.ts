import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect as nextRedirect } from "next/navigation";
import { redirect as localizedRedirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { forbidden, unauthorized } from "@/lib/errors";
import type { Actor, Permission, SessionUser, UserRole } from "@/lib/types/domain";
import { can } from "@/lib/permissions";
import { getAuth } from "./auth";

/**
 * The ONLY way UI, actions and route handlers read the session (ARCHITECTURE.md > Auth).
 * Role / disabled changes apply immediately because the session cookie cache is off.
 */

export { can };

export function toActor(user: SessionUser): Actor {
  return { id: user.id, email: user.email, role: user.role };
}

/** null when signed out (or the account is disabled). Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
  if (!session?.user) return null;
  const u = session.user as unknown as { id: string; email: string; name: string; role?: string; locale?: string; image?: string | null; disabled?: boolean };
  if (u.disabled) return null;
  const role: UserRole = u.role === "admin" || u.role === "staff" ? u.role : "customer";
  return { id: u.id, email: u.email, name: u.name, role, locale: u.locale === "tr" ? "tr" : "en", image: u.image ?? null };
});

export async function requireUser(locale: Locale, nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    localizedRedirect({ href: { pathname: "/login", ...(nextPath ? { query: { next: nextPath } } : {}) }, locale });
  }
  return user as SessionUser;
}

/** Admin pages: signed out -> /admin/login, customers or missing permission -> forbidden error. */
export async function requireStaff(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) nextRedirect("/admin/login");
  const u = user as SessionUser;
  if (u.role === "customer" || (permission && !can(u.role, permission))) throw forbidden();
  return u;
}

/**
 * Role gate for server components (redirects to /admin/login when signed out, throws forbidden otherwise).
 * Prefer `requireStaff(permission)`: permissions are finer grained than roles.
 */
export async function requireRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getSessionUser();
  if (!user) nextRedirect("/admin/login");
  const u = user as SessionUser;
  if (!allowed.includes(u.role)) throw forbidden();
  return u;
}

/** Role gate for Server Actions / route handlers (throws unauthorized / forbidden instead of redirecting). */
export async function assertRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (!allowed.includes(user.role)) throw forbidden();
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function assertStaff(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (user.role === "customer" || (permission && !can(user.role, permission))) throw forbidden();
  return user;
}
