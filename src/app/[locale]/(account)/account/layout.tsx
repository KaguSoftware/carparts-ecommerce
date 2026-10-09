import { setRequestLocale } from "next-intl/server";
import { AccountNav } from "@/components/account/shell/AccountNav";
import { SignOutButton } from "@/components/account/shell/SignOutButton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";

/** Everything under /account requires a signed-in user (the proxy only does a cheap cookie check; this is the real gate). */
export default async function AccountAreaLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale as Locale, "/account");
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase(locale))
    .join("");

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
          <div className="mb-5 flex items-center gap-3">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-secondary font-display text-xl font-bold text-secondary-foreground">
              {initials || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
            <div className="lg:hidden">
              <SignOutButton />
            </div>
          </div>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
