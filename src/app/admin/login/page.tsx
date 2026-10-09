import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/admin/shell/LoginForm";
import { AdminLocaleSwitch } from "@/components/admin/shell/AdminLocaleSwitch";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { safeAdminNext } from "@/actions/admin/auth.schema";
import { getSessionUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.login");
  return { title: t("title") };
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeAdminNext(rawNext);

  const user = await getSessionUser();
  if (user && user.role !== "customer") redirect(next);

  const t = await getTranslations("admin.login");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <aside className="relative hidden flex-col justify-between bg-inverse p-12 text-inverse-foreground lg:flex">
        <Logo variant="dark" height={48} />
        <div>
          <p className="display-2 max-w-md">{t("panelTitle")}</p>
          <p className="mt-4 max-w-sm text-inverse-muted">{t("panelBody")}</p>
        </div>
        <div aria-hidden className="ruler" />
      </aside>

      <main id="main" className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo height={36} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <AdminLocaleSwitch />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="display-3">{t("title")}</h1>
          <p className="mt-2 mb-8 text-sm text-muted">{t("subtitle")}</p>
          <LoginForm next={next} customerHint={user?.role === "customer"} />
        </div>
      </main>
    </div>
  );
}
