"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/actions/account/auth";
import { Button } from "@/components/ui";
import type { Locale } from "@/i18n/routing";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("account.nav");
  const locale = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      className={className}
      loading={pending}
      leftIcon={<LogOut className="size-4.5" aria-hidden />}
      onClick={() => {
        startTransition(async () => {
          await signOutAction({ locale });
        });
      }}
    >
      {t("signOut")}
    </Button>
  );
}
