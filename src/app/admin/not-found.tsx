import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonStyles } from "@/components/ui/Button";

export default async function AdminNotFound() {
  const t = await getTranslations("admin.shell");
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="display-3">{t("notFoundTitle")}</h1>
      <p className="text-muted">{t("notFoundBody")}</p>
      <Link href="/admin" className={buttonStyles({ variant: "secondary" })}>
        {t("backToDashboard")}
      </Link>
    </main>
  );
}
