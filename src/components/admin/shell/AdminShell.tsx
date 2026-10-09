"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, LogOut, Menu } from "lucide-react";
import { adminSignOutAction } from "@/actions/admin/auth";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AdminLocaleSwitch } from "./AdminLocaleSwitch";
import { NAV, isActive } from "./nav";

export interface AdminShellProps {
  user: { name: string; email: string; role: Exclude<UserRole, "customer"> };
  /** Counters shown next to nav items: { reviews: 3, messages: 1 } */
  badges: Record<string, number>;
  children: ReactNode;
}

function SidebarNav({ role, badges, onNavigate }: { role: UserRole; badges: Record<string, number>; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => {
        const items = group.items.filter((item) => can(role, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.key}>
            <p className="label-caps px-2 pb-1.5 text-inverse-muted">{t(`groups.${group.key}`)}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = badges[item.key] ?? 0;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.9375rem] transition-colors",
                        active ? "bg-inverse-surface font-medium text-inverse-foreground" : "text-inverse-muted hover:bg-inverse-surface/60 hover:text-inverse-foreground",
                      )}
                    >
                      <item.icon className={cn("size-4.5 shrink-0", active && "text-primary")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{t(`items.${item.key}`)}</span>
                      {count > 0 ? (
                        <Badge tone="primary" className="num px-1.5 py-0.5 text-[0.6875rem]">
                          <span aria-hidden>{count > 99 ? "99+" : count}</span>
                          <span className="sr-only">{t("badge", { count })}</span>
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  const t = useTranslations("admin.shell");
  return (
    <Link href="/admin" className="flex items-center gap-2 px-5 py-4" aria-label={t("home")}>
      <Logo variant="dark" height={34} title="" />
      <span className="label-caps rounded-xs bg-primary px-1.5 py-1 text-[0.6875rem] text-primary-foreground">{t("adminTag")}</span>
    </Link>
  );
}

/** Admin chrome: dark sidebar (drawer on small screens), top bar with language / theme / account. */
export function AdminShell({ user, badges, children }: AdminShellProps) {
  const t = useTranslations("admin.shell");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-inverse-border bg-inverse text-inverse-foreground lg:flex print:hidden">
        <Brand />
        <SidebarNav role={user.role} badges={badges} />
        <p className="border-t border-inverse-border px-5 py-3 text-xs text-inverse-muted">{t("footer")}</p>
      </aside>

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement="left"
        title={t("menu")}
        hideTitle
        className="max-w-72 border-inverse-border bg-inverse text-inverse-foreground [&>header]:border-inverse-border [&>header_button]:text-inverse-muted [&>div]:p-0"
      >
        <Brand />
        <SidebarNav role={user.role} badges={badges} onNavigate={() => setMenuOpen(false)} />
      </Modal>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 sm:px-5 print:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("openMenu")}
            className="inline-flex size-10 items-center justify-center rounded-sm text-foreground hover:bg-surface-sunken lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex-1" />
          <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm text-muted hover:bg-surface-sunken hover:text-foreground sm:inline-flex">
            {t("viewStore")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <AdminLocaleSwitch className="text-foreground" />
          <ThemeToggle className="text-foreground" />
          <div className="ml-1 hidden min-w-0 flex-col items-end leading-tight sm:flex">
            <span className="max-w-44 truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="label-caps text-muted">{t(`role.${user.role}`)}</span>
          </div>
          <form action={adminSignOutAction}>
            <button type="submit" aria-label={t("signOut")} title={t("signOut")} className="inline-flex size-10 items-center justify-center rounded-sm text-foreground hover:bg-surface-sunken">
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
