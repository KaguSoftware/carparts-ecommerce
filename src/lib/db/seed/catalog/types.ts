import type { LocalizedString } from "@/lib/i18n-string";
import type { ProductStatus, Vehicle } from "@/lib/types/domain";
import { L, trNum } from "../util";

export type Tier = "value" | "standard" | "premium" | "performance";
export type Fuel = Vehicle["fuel"];

export interface SpecTpl {
  key: LocalizedString;
  value: LocalizedString;
}

export interface VariantTpl {
  /** Short code appended to the SKU. */
  code: string;
  name: LocalizedString;
  optionName: LocalizedString;
  /** Percent of the offer's base price (100 = base). */
  mult: number;
  weightMult?: number;
  stockMult?: number;
  isDefault?: boolean;
}

/** One sellable product line (brand + series) of a family. */
export interface OfferDef {
  brand: string;
  line: string;
  /** Base price in USD cents for the default variant. */
  price: number;
  tier: Tier;
  /** Display discount in percent: sets compareAtPrice so that price = compareAt * (1 - deal/100). */
  deal?: number;
  featured?: boolean;
  status?: ProductStatus;
  /** Created within the last few weeks (feeds "New arrivals"). */
  isNew?: boolean;
  /** Force a stock situation for demo purposes. */
  stock?: "out" | "low" | "high";
  extra?: SpecTpl[];
}

export interface FamilyDef {
  key: string;
  /** Subcategory slug. */
  sub: string;
  /** Illustration kind (see scripts/art). */
  art: string;
  /** 2-4 letters used in SKUs and part numbers. */
  code: string;
  name: LocalizedString;
  /** Plural noun used in review text ("brake pads"). Must read correctly in the nominative case. */
  noun: LocalizedString;
  summary: LocalizedString;
  intro: LocalizedString;
  features: { en: string[]; tr: string[] };
  specs: SpecTpl[];
  variants: VariantTpl[];
  /** Grams of the default variant. */
  weight: number;
  /** Base warranty in months (tier adds to it). */
  warranty: number;
  fitment: "universal" | { fuels?: Fuel[]; core?: [number, number] };
  tags: string[];
  condition?: "new" | "remanufactured";
  lowStock?: number;
  notes?: LocalizedString[];
  offers: OfferDef[];
}

/* ------------------------------------------------------------------ authoring helpers */

export const spec = (enKey: string, trKey: string, enVal: string, trVal: string = trNum(enVal)): SpecTpl => ({
  key: L(enKey, trKey),
  value: L(enVal, trVal),
});

export const offer = (brand: string, line: string, price: number, tier: Tier, rest: Partial<Omit<OfferDef, "brand" | "line" | "price" | "tier">> = {}): OfferDef => ({
  brand,
  line,
  price,
  tier,
  ...rest,
});

const POSITION = L("Position", "Konum");
const SIDE = L("Side", "Taraf");

export const frontRear = (rearMult = 85): VariantTpl[] => [
  { code: "F", name: L("Front axle", "Ön aks"), optionName: POSITION, mult: 100, isDefault: true },
  { code: "R", name: L("Rear axle", "Arka aks"), optionName: POSITION, mult: rearMult },
];

export const leftRight = (): VariantTpl[] => [
  { code: "L", name: L("Left", "Sol"), optionName: SIDE, mult: 100, isDefault: true },
  { code: "R", name: L("Right", "Sağ"), optionName: SIDE, mult: 100 },
];

export const single = (name: LocalizedString = L("Standard", "Standart")): VariantTpl[] => [
  { code: "S", name, optionName: L("Type", "Tip"), mult: 100, isDefault: true },
];
