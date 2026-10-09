import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing, isLocale } from "./i18n/routing";

/**
 * Next 16 `proxy` (formerly middleware). Runs before routing.
 *
 *  - /admin/**       -> cheap session-cookie gate (real auth + RBAC is enforced server-side in
 *                       layouts/actions via requireAdmin()). /admin/login is public.
 *  - /{locale}/account/** -> cheap session-cookie gate, redirects to /{locale}/login?next=...
 *  - everything else -> next-intl locale negotiation / prefixing.
 *
 * The cookie check is only a UX shortcut. It is NOT a security boundary.
 */
const handleI18n = createMiddleware(routing);

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];
const hasSessionCookie = (req: NextRequest) => SESSION_COOKIES.some((name) => req.cookies.has(name));

const PROTECTED_ACCOUNT_PREFIX = "/account";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ---- Admin ---------------------------------------------------------------
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
    if (!isLogin && !hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("x-robots-tag", "noindex, nofollow");
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  // ---- Account (locale-prefixed) --------------------------------------------
  const [, first, ...rest] = pathname.split("/");
  if (isLocale(first)) {
    const sub = "/" + rest.join("/");
    if ((sub === PROTECTED_ACCOUNT_PREFIX || sub.startsWith(PROTECTED_ACCOUNT_PREFIX + "/")) && !hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${first}/login`;
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return handleI18n(request);
}

export const config = {
  // Skip API routes, Next internals, Vercel internals and anything that looks like a file.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
