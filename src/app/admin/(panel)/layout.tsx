import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { adminSignOutAction } from "@/actions/admin/auth";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listMessages } from "@/lib/services/contact";
import { adminListReviews } from "@/lib/services/reviews";

/**
 * Admin panel shell. The proxy only checks that a session cookie exists; the real checks happen here
 * (signed in, staff or admin) and again in every page (`requireStaff(permission)`) and Server Action (`assertStaff`).
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  if (user.role === "customer") {
    const t = await getTranslations("admin.shell");
    return (
      <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-5 px-6">
        <Logo height={40} />
        <h1 className="display-3">{t("noAccessTitle")}</h1>
        <p className="text-muted">{t("noAccessBody")}</p>
        <form action={adminSignOutAction}>
          <Button type="submit" variant="outline" leftIcon={<LogOut className="size-4" />}>
            {t("signOut")}
          </Button>
        </form>
      </main>
    );
  }

  const [pendingReviews, newMessages] = await Promise.all([
    can(user.role, "reviews.moderate") ? adminListReviews({ status: "pending", pageSize: 1 }).then((r) => r.total) : 0,
    can(user.role, "customers.read") ? listMessages({ status: "new", pageSize: 1 }).then((r) => r.total) : 0,
  ]);

  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} badges={{ reviews: pendingReviews, messages: newMessages }}>
      {children}
    </AdminShell>
  );
}
