"use client";

import { useId, type ReactNode } from "react";
import { Controller, useFormContext, type FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, type InputProps } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { emptyLs } from "./form-utils";
import { IntegerInput, ListInput, MoneyInput, PercentInput } from "./NumberInputs";
import { LocalizedField, type LocalizedFieldProps } from "./LocalizedField";
import { useFieldError } from "./use-field-error";

/**
 * Thin react-hook-form bindings so feature forms read like a layout, not like plumbing.
 * All of them rely on a surrounding <FormProvider> and address fields by dot path ("product.name.en").
 */

interface Common {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

export function RhfLocalized({ name, ...props }: { name: string } & Omit<LocalizedFieldProps, "value" | "onChange" | "errors">) {
  const { control, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <LocalizedField {...props} value={field.value ?? emptyLs()} onChange={field.onChange} errors={{ en: fe(`${name}.en`), tr: fe(`${name}.tr`) }} />}
    />
  );
}

export function RhfText({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size">) {
  const { register, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
      <Input size="sm" {...input} {...register(name)} />
    </Field>
  );
}

export function RhfTextarea({ name, label, hint, required, className, rows = 4 }: Common & { rows?: number }) {
  const { register, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
      <Textarea rows={rows} {...register(name)} />
    </Field>
  );
}

export function RhfInteger({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size" | "value" | "onChange" | "type">) {
  const { control, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
          <IntegerInput size="sm" {...input} value={field.value as number | undefined} onChange={field.onChange} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

export function RhfMoney({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size" | "value" | "onChange" | "type">) {
  const { control, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
          <MoneyInput size="sm" {...input} value={field.value as number | undefined} onChange={field.onChange} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

export function RhfList({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size" | "value" | "onChange" | "type">) {
  const { control, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
          <ListInput size="sm" {...input} value={(field.value as string[] | undefined) ?? []} onChange={field.onChange} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

export function RhfSelect({ name, label, hint, required, className, children, disabled }: Common & { children: ReactNode; disabled?: boolean }) {
  const { register, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
      <Select size="sm" disabled={disabled} {...register(name)}>
        {children}
      </Select>
    </Field>
  );
}

export function RhfSwitch({ name, label, description, className }: { name: string; label: string; description?: string; className?: string }) {
  const { control } = useFormContext<FieldValues>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Switch id={id} className={className} checked={!!field.value} onCheckedChange={field.onChange} label={label} description={description} />}
    />
  );
}

export function RhfCheckbox({ name, label, description, className }: { name: string; label: string; description?: string; className?: string }) {
  const { register } = useFormContext<FieldValues>();
  return <Checkbox className={className} label={label} description={description} {...register(name)} />;
}

export function RhfPercent({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size" | "value" | "onChange" | "type">) {
  const { control, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
          <PercentInput size="sm" {...input} value={field.value as number | undefined} onChange={field.onChange} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

/** Plain decimal/number input registered with valueAsNumber (blank -> NaN -> "number_invalid"). */
export function RhfNumber({ name, label, hint, required, className, ...input }: Common & Omit<InputProps, "name" | "size" | "type">) {
  const { register, formState } = useFormContext<FieldValues>();
  const fe = useFieldError(formState.errors);
  return (
    <Field label={label} hint={hint} required={required} error={fe(name)} className={className}>
      <Input size="sm" type="number" inputMode="decimal" step="any" {...input} {...register(name, { valueAsNumber: true })} />
    </Field>
  );
}
