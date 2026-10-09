"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintButton() {
  const t = useTranslations("admin.common");
  return (
    <Button type="button" size="sm" variant="outline" className="no-print" leftIcon={<Printer className="size-4" />} onClick={() => window.print()}>
      {t("print")}
    </Button>
  );
}
