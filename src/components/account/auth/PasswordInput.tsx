"use client";

import { useState, type ComponentProps, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type" | "trailing"> & { ref?: Ref<HTMLInputElement> };

/**
 * Password field with a show / hide toggle. React 19 passes `ref` as a normal prop, so react-hook-form's
 * `{...register("password")}` spread reaches the underlying <input> untouched.
 */
export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations("auth.password");
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t("hide") : t("show")}
          className="inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      }
    />
  );
}
