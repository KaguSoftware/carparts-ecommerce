"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Field, Input, Select } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { errorCode } from "./form-utils";
import { regionOptions, type CountryOption } from "./regions";

export interface AddressFieldsProps {
  /** Form path prefix including the trailing dot ("shipping."), or "" for a flat form. */
  prefix?: string;
  countries: CountryOption[];
  /** Used in `autocomplete` section tokens so browsers fill shipping and billing independently. */
  section?: "shipping" | "billing";
  /** Fires when the country select changes (checkout re-quotes shipping and tax). */
  onCountryChange?: (country: string) => void;
}

/**
 * The ten address inputs, wired to the surrounding react-hook-form context. Used by the address book dialog (flat form)
 * and by checkout (`shipping.` / `billing.` prefixes).
 */
export function AddressFields({ prefix = "", countries, section, onCountryChange }: AddressFieldsProps) {
  const t = useTranslations("account.addresses.fields");
  const { validation } = useErrorText();
  const { register, setValue, control, formState } = useFormContext<FieldValues>();
  const name = (field: string) => `${prefix}${field}`;
  const country = (useWatch({ control, name: name("country") }) as string | undefined) ?? "";
  const regions = regionOptions(country);
  const err = (field: string) => {
    const code = errorCode(formState.errors, name(field));
    return code ? validation(code) : undefined;
  };
  const auto = (token: string) => (section ? `${section} ${token}` : token);

  const countryReg = register(name("country"), {
    onChange: (event: { target: { value: string } }) => {
      setValue(name("region"), "", { shouldDirty: true });
      onCountryChange?.(event.target.value);
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("firstName")} error={err("firstName")} required>
        <Input autoComplete={auto("given-name")} {...register(name("firstName"))} />
      </Field>
      <Field label={t("lastName")} error={err("lastName")} required>
        <Input autoComplete={auto("family-name")} {...register(name("lastName"))} />
      </Field>
      <Field label={t("company")} error={err("company")} optional className="sm:col-span-2">
        <Input autoComplete={auto("organization")} {...register(name("company"))} />
      </Field>
      <Field label={t("line1")} error={err("line1")} required className="sm:col-span-2">
        <Input autoComplete={auto("address-line1")} {...register(name("line1"))} />
      </Field>
      <Field label={t("line2")} error={err("line2")} optional className="sm:col-span-2">
        <Input autoComplete={auto("address-line2")} {...register(name("line2"))} />
      </Field>
      <Field label={t("country")} error={err("country")} required>
        <Select autoComplete={auto("country")} {...countryReg}>
          <option value="" disabled>
            {t("countryPlaceholder")}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={regions ? t("regionState") : t("region")} error={err("region")} optional={!regions} required={Boolean(regions)}>
        {regions ? (
          <Select autoComplete={auto("address-level1")} {...register(name("region"))}>
            <option value="">{t("regionPlaceholder")}</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input autoComplete={auto("address-level1")} {...register(name("region"))} />
        )}
      </Field>
      <Field label={t("city")} error={err("city")} required>
        <Input autoComplete={auto("address-level2")} {...register(name("city"))} />
      </Field>
      <Field label={t("postalCode")} error={err("postalCode")} required>
        <Input autoComplete={auto("postal-code")} {...register(name("postalCode"))} />
      </Field>
      <Field label={t("phone")} error={err("phone")} required className="sm:col-span-2">
        <Input type="tel" inputMode="tel" autoComplete={auto("tel")} {...register(name("phone"))} />
      </Field>
    </div>
  );
}
