"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CarFront, ChevronDown } from "lucide-react";
import { clearVehicleAction } from "@/actions/store/vehicle";
import { Button, Modal, buttonStyles, useToast } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";
import type { VehicleSelection } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { VehicleSelector } from "./VehicleSelector";

export interface GarageButtonProps {
  label: string | null;
  selection: VehicleSelection;
  className?: string;
  /** Show the vehicle label next to the icon on small screens too. */
  alwaysShowLabel?: boolean;
  /** Number of catalogue parts that fit the saved vehicle (shown under the label). */
  fitCount?: number;
}

/** Header "My Garage" control: shows the saved vehicle and opens the selector dialog. */
export function GarageButton({ label, selection, className, alwaysShowLabel, fitCount }: GarageButtonProps) {
  const t = useTranslations("store.vehicle");
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function clear() {
    startTransition(async () => {
      const result = await clearVehicleAction();
      if (result.ok) {
        toast.info(t("cleared"));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(actionError(result));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "group inline-flex h-12 max-w-72 items-center gap-2.5 border pr-3 text-current transition-colors hover:border-primary",
          label ? "border-current/40 bg-current/10" : "border-current/25",
          className,
        )}
      >
        <span className={cn("inline-flex h-full w-11 shrink-0 items-center justify-center", label ? "bg-primary text-primary-foreground" : "bg-current/10")}>
          <CarFront className="size-6" aria-hidden />
        </span>
        <span className={cn("min-w-0 text-left leading-tight", !alwaysShowLabel && "hidden md:block")}>
          <span className="tag-mono block opacity-75">{t("garage")}</span>
          <span className="block truncate text-[0.875rem] font-semibold">{label ?? t("selectVehicle")}</span>
          {label && fitCount !== undefined ? <span className="tag-mono block text-primary">{t("partsFit", { count: fitCount })}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 opacity-70", !alwaysShowLabel && "hidden md:block")} aria-hidden />
        <span className={cn("sr-only", !alwaysShowLabel && "md:hidden")}>{label ? t("garageWithVehicle", { label }) : t("openSelector")}</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("dialogTitle")}
        description={label ? t("dialogCurrent", { label }) : t("dialogDescription")}
        footer={
          <>
            <Link href="/garage" onClick={() => setOpen(false)} className={buttonStyles({ variant: "link" })}>
              {t("manageGarage")}
            </Link>
            {label ? (
              <Button variant="outline" onClick={clear} loading={pending}>
                {t("remove")}
              </Button>
            ) : null}
          </>
        }
      >
        <VehicleSelector idPrefix="gb" initial={selection} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}
