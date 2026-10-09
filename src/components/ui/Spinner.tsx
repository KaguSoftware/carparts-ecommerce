import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  const t = useTranslations("ui.spinner");
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={cn("size-5 animate-spin text-muted", className)} aria-hidden />
      <span className="sr-only">{label ?? t("loading")}</span>
    </span>
  );
}
