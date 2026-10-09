import type { AddressInput } from "@/lib/types/domain";
import { countryName } from "./order-format";

/** Postal-style address block. Always rendered inside a labelled region by the caller. */
export function AddressBlock({ address, locale, showPhone = true }: { address: AddressInput; locale: string; showPhone?: boolean }) {
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  const regionLine = [cityLine, address.region].filter(Boolean).join(", ");
  return (
    <address className="space-y-0.5 text-[0.9375rem] not-italic leading-relaxed text-foreground">
      <p className="font-medium">
        {address.firstName} {address.lastName}
      </p>
      {address.company ? <p>{address.company}</p> : null}
      <p>{address.line1}</p>
      {address.line2 ? <p>{address.line2}</p> : null}
      <p>{regionLine}</p>
      <p>{countryName(address.country, locale)}</p>
      {showPhone && address.phone ? <p className="num text-muted">{address.phone}</p> : null}
    </address>
  );
}
