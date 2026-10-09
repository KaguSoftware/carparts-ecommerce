"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { clearVehicleAction } from "@/actions/store/vehicle";
import { Button, useToast } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";

export function ClearVehicleButton() {
  const t = useTranslations("store.vehicle");
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      leftIcon={<Trash2 className="size-4" aria-hidden />}
      onClick={() =>
        startTransition(async () => {
          const result = await clearVehicleAction();
          if (result.ok) {
            toast.info(t("cleared"));
            router.refresh();
          } else {
            toast.error(actionError(result));
          }
        })
      }
    >
      {t("remove")}
    </Button>
  );
}
