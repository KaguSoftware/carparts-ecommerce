import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  invalid?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** Already-translated error text (see useValidationText). */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  /** Show the "(optional)" tag next to the label. */
  optional?: boolean;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  className?: string;
  /** A control element (Input/Select/Textarea) which receives id + aria wiring, or a render function. */
  children: ReactElement<Record<string, unknown>> | ((props: FieldControlProps) => ReactNode);
}

/**
 * Label + control + hint + error with correct id / aria-describedby / aria-invalid wiring.
 *
 *   <Field label={t("email")} error={err("email")} required>
 *     <Input name="email" type="email" autoComplete="email" />
 *   </Field>
 */
export function Field({ label, error, hint, required, optional, hideLabel, className, children }: FieldProps) {
  const t = useTranslations("ui.field");
  const uid = useId();
  const id = `f-${uid.replace(/:/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const controlProps: FieldControlProps = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required ? true : undefined,
    invalid: !!error,
  };

  const control =
    typeof children === "function"
      ? children(controlProps)
      : isValidElement(children)
        ? cloneElement(children, { ...controlProps, required: required ?? children.props.required })
        : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-foreground", hideLabel && "sr-only")}>
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
        {optional && !required ? <span className="ml-1.5 font-normal text-muted">({t("optional")})</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] leading-snug text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] font-medium leading-snug text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
