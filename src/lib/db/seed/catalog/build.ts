import type { LocalizedString } from "@/lib/i18n-string";
import type { FitmentRow, InventoryMovement, Product, ProductImage, ProductSpec, ProductVariant } from "@/lib/types/domain";
import { slugify } from "@/lib/utils";
import { BRAND_CODE, BRAND_DEFS, brandId } from "../brands";
import { PARENT_OF, categoryId } from "../categories";
import type { VehicleData } from "../vehicles";
import { VEHICLE_CONFIGS } from "../vehicles";
import { DAY, L, Rng, SYSTEM_ACTOR, ean13, ending99, hashString, pad, type SeedClock } from "../util";
import { BODY } from "./body";
import { BRAKES } from "./brakes";
import { COOLING } from "./cooling";
import { ELECTRICAL } from "./electrical";
import { ENGINE } from "./engine";
import { EXHAUST } from "./exhaust";
import { FILTERS } from "./filters";
import { FLUIDS } from "./fluids";
import { LIGHTING } from "./lighting";
import { SUSPENSION } from "./suspension";
import type { FamilyDef, OfferDef, Tier } from "./types";

export const FAMILIES: FamilyDef[] = [...BRAKES, ...ENGINE, ...SUSPENSION, ...FILTERS, ...LIGHTING, ...ELECTRICAL, ...EXHAUST, ...COOLING, ...BODY, ...FLUIDS];

const HOUSE_BRAND = "apexline-select";
const brandName = (key: string) => BRAND_DEFS.find((b) => b.key === key)?.name ?? key;

/* ------------------------------------------------------------------ text */

const TIER_TEXT: Record<Tier, LocalizedString> = {
  value: L(
    "A budget-friendly replacement that meets original-equipment requirements for everyday driving.",
    "Günlük kullanım için orijinal ekipman gereksinimlerini karşılayan, bütçe dostu bir yedek parça.",
  ),
  standard: L(
    "A dependable all-rounder built to original-equipment specification.",
    "Orijinal ekipman spesifikasyonuna göre üretilmiş, güvenilir bir çok amaçlı parça.",
  ),
  premium: L(
    "Premium-grade materials and tighter tolerances for longer service life and a more refined feel.",
    "Daha uzun ömür ve daha rafine bir his için üstün kalite malzeme ve daha dar toleranslar.",
  ),
  performance: L(
    "Engineered for spirited and demanding driving, with improved heat tolerance and response.",
    "Tempolu ve zorlu sürüş için tasarlandı; ısı dayanımı ve tepkisi geliştirilmiştir.",
  ),
};

const TIER_WARRANTY_BONUS: Record<Tier, number> = { value: 0, standard: 6, premium: 12, performance: 6 };

function monthsText(n: number): LocalizedString {
  return L(`${n} months`, `${n} ay`);
}

function buildDescription(family: FamilyDef, offer: OfferDef, warranty: number, line: string): LocalizedString {
  const fitEn =
    family.fitment === "universal"
      ? "This product is universal: it works with any vehicle that uses this type of part. Check your owner's manual for the correct size or specification."
      : "This part is matched to specific vehicles. Select your car in the finder or use the fitment checker on this page to confirm it fits before you order.";
  const fitTr =
    family.fitment === "universal"
      ? "Bu ürün evrenseldir: bu tip parçayı kullanan her araçla çalışır. Doğru ölçü veya spesifikasyon için kullanım kılavuzunuza bakın."
      : "Bu parça belirli araçlarla eşleştirilmiştir. Sipariş vermeden önce uyumluluğu doğrulamak için araç seçiciyi veya bu sayfadaki uyumluluk denetleyicisini kullanın.";
  const condEn = family.condition === "remanufactured" ? " Remanufactured to original-equipment standards and tested before dispatch." : "";
  const condTr = family.condition === "remanufactured" ? " Orijinal ekipman standartlarında yenilenmiş ve gönderimden önce test edilmiştir." : "";
  const warEn = warranty > 0 ? ` ${line ? `The ${line} series is` : "It is"} backed by a ${warranty}-month warranty.` : "";
  const warTr = warranty > 0 ? ` ${line ? `${line} serisi` : "Ürün"} ${warranty} ay garantilidir.` : "";

  const en = [
    family.intro.en,
    "## Key features",
    family.features.en.map((f) => `- ${f}`).join("\n"),
    "## About this product",
    `${TIER_TEXT[offer.tier].en}${condEn}${warEn}`,
    "## Fitment",
    fitEn,
  ].join("\n\n");
  const tr = [
    family.intro.tr,
    "## Öne çıkan özellikler",
    family.features.tr.map((f) => `- ${f}`).join("\n"),
    "## Bu ürün hakkında",
    `${TIER_TEXT[offer.tier].tr}${condTr}${warTr}`,
    "## Uyumluluk",
    fitTr,
  ].join("\n\n");
  return L(en, tr);
}

/* ------------------------------------------------------------------ OEM numbers (invented) */

function oemNumber(rng: Rng): string {
  const d = (n: number) => Array.from({ length: n }, () => rng.int(0, 9)).join("");
  const letter = () => String.fromCharCode(65 + rng.int(0, 25));
  switch (rng.int(0, 5)) {
    case 0:
      return `${rng.int(1, 9)}${letter()}${rng.int(0, 9)} ${d(3)} ${d(3)}`;
    case 1:
      return `${d(2)} ${d(2)} ${rng.int(1, 9)} ${d(3)} ${d(3)}`;
    case 2:
      return `${d(5)}-${d(5)}`;
    case 3:
      return `A ${d(3)} ${d(3)} ${d(2)} ${d(2)}`;
    case 4:
      return `${d(4)} ${d(3)} ${d(3)}`;
    default:
      return `${rng.int(1, 9)} ${d(3)} ${d(3)}`;
  }
}

/* ------------------------------------------------------------------ output */

export interface BuiltProduct {
  product: Product;
  variants: ProductVariant[];
  family: FamilyDef;
  offer: OfferDef;
  /** Initial physical stock per variant (before any seeded order consumed it). */
  initialStock: Record<string, number>;
}

export interface ArtJob {
  /** File name under public/products. */
  file: string;
  kind: string;
  view: "hero" | "detail";
  tier: Tier;
  brandKey: string;
  label: string;
  code: string;
  seed: string;
}

export interface CatalogData {
  built: BuiltProduct[];
  products: Product[];
  variants: ProductVariant[];
  fitment: FitmentRow[];
  movements: InventoryMovement[];
  artJobs: ArtJob[];
}

export function buildCatalog(clock: SeedClock, vehicles: VehicleData): CatalogData {
  const built: BuiltProduct[] = [];
  const fitment: FitmentRow[] = [];
  const movements: InventoryMovement[] = [];
  const artJobs: ArtJob[] = [];
  const usedSlugs = new Set<string>();
  const usedParts = new Set<string>();
  let seq = 0;
  let movementSeq = 0;

  for (const family of FAMILIES) {
    const familyRng = new Rng(`family:${family.key}`);
    // Core set of vehicle configs this family fits; each offer fits most of them.
    let coreConfigs: string[] = [];
    if (family.fitment !== "universal") {
      const { fuels, core } = family.fitment;
      const eligible = VEHICLE_CONFIGS.filter((c) => !fuels || fuels.includes(c.fuel));
      const [min, max] = core ?? [8, 12];
      const count = Math.min(eligible.length, familyRng.int(min, max));
      coreConfigs = familyRng.sampleWeighted(eligible, (c) => c.pop, count).map((c) => c.key);
    }

    family.offers.forEach((offer, offerIndex) => {
      seq++;
      const id = `prd_${pad(seq, 3)}`;
      const rng = new Rng(`${family.key}:${offer.brand}:${offer.line}`);
      const bName = brandName(offer.brand);
      const isHouse = offer.brand === HOUSE_BRAND;
      const nameEn = isHouse ? `${bName} ${family.name.en}` : `${bName} ${offer.line} ${family.name.en}`;
      const nameTr = isHouse ? `${bName} ${family.name.tr}` : `${bName} ${offer.line} ${family.name.tr}`;
      let slug = slugify(nameEn);
      if (usedSlugs.has(slug)) slug = `${slug}-${seq}`;
      usedSlugs.add(slug);

      const code = BRAND_CODE[offer.brand] ?? "GEN";
      let partNumber = `${code}-${family.code}${100 + (hashString(slug) % 900)}`;
      while (usedParts.has(partNumber)) partNumber += "A";
      usedParts.add(partNumber);

      const warranty = family.warranty === 0 ? 0 : family.warranty + TIER_WARRANTY_BONUS[offer.tier];
      const isUniversal = family.fitment === "universal";
      const oemNumbers = isUniversal ? [] : Array.from({ length: rng.int(1, 3) }, () => oemNumber(rng));

      // Dates
      const ageDays = offer.isNew ? rng.int(3, 24) : rng.int(35, 420);
      const createdMs = clock.now - ageDays * DAY;
      const updatedMs = createdMs + Math.floor((clock.now - createdMs) * rng.next() * 0.8);
      const createdAt = new Date(createdMs).toISOString();
      const updatedAt = new Date(updatedMs).toISOString();

      // Specs
      const specs: ProductSpec[] = [
        ...family.specs.map((s) => ({ key: s.key, value: s.value })),
        ...(offer.extra ?? []).map((s) => ({ key: s.key, value: s.value })),
      ];
      specs.push({ key: L("Series", "Seri"), value: L(isHouse ? "Select" : offer.line, isHouse ? "Select" : offer.line) });
      specs.push({
        key: L("Condition", "Durum"),
        value: family.condition === "remanufactured" ? L("Remanufactured", "Yenilenmiş") : L("New", "Yeni"),
      });
      if (warranty > 0) specs.push({ key: L("Warranty", "Garanti"), value: monthsText(warranty) });

      // Images
      const images: ProductImage[] = [
        { id: `img_${id}_1`, url: `/products/${slug}-1.svg`, alt: L(`${nameEn} - product view`, `${nameTr} - ürün görünümü`), sortOrder: 0 },
        { id: `img_${id}_2`, url: `/products/${slug}-2.svg`, alt: L(`${nameEn} - detail view`, `${nameTr} - detay görünümü`), sortOrder: 1 },
      ];
      artJobs.push(
        { file: `${slug}-1.svg`, kind: family.art, view: "hero", tier: offer.tier, brandKey: offer.brand, label: partNumber, code: family.code, seed: slug },
        { file: `${slug}-2.svg`, kind: family.art, view: "detail", tier: offer.tier, brandKey: offer.brand, label: partNumber, code: family.code, seed: slug },
      );

      const parent = PARENT_OF[family.sub];
      const categoryIds = [categoryId(family.sub), ...(parent ? [categoryId(parent)] : [])];

      const product: Product = {
        id,
        slug,
        name: L(nameEn, nameTr),
        summary: family.summary,
        description: buildDescription(family, offer, warranty, isHouse ? "" : offer.line),
        brandId: brandId(offer.brand),
        categoryId: categoryId(family.sub),
        categoryIds,
        images,
        specs,
        tags: [...new Set([...family.tags, offer.brand.replace(/-/g, " "), offer.tier, family.sub.replace(/-/g, " ")])],
        status: offer.status ?? "active",
        isFeatured: Boolean(offer.featured),
        partNumber,
        oemNumbers,
        warrantyMonths: warranty,
        fitment: isUniversal ? "universal" : "specific",
        ratingAverage: 0,
        ratingCount: 0,
        soldCount: 0,
        seoTitle: L(nameEn, nameTr),
        seoDescription: family.summary,
        createdAt,
        updatedAt,
      };

      // Variants
      const variants: ProductVariant[] = [];
      const initialStock: Record<string, number> = {};
      const threshold = family.lowStock ?? 5;
      family.variants.forEach((vt, vi) => {
        const vid = `var_${pad(seq, 3)}_${vt.code.toLowerCase()}`;
        const sku = `${code}-${family.code}${offerIndex + 1}-${vt.code}`;
        const vrng = new Rng(`stock:${sku}`);
        const price = vt.mult === 100 ? offer.price : ending99((offer.price * vt.mult) / 100);
        const compareAt = offer.deal ? ending99((price * 100) / (100 - offer.deal)) : undefined;
        const cost = Math.round(price * (0.55 + (hashString(sku) % 16) / 100));

        const cap = price > 15000 ? 24 : price > 8000 ? 60 : price > 3000 ? 110 : 160;
        let stock: number;
        const roll = vrng.next();
        if (offer.stock === "out" || (!offer.stock && roll < 0.05)) stock = 0;
        else if (offer.stock === "low" || (!offer.stock && roll < 0.14)) stock = vrng.int(1, Math.max(1, threshold));
        else stock = vrng.int(threshold + 4, cap);
        if (vt.stockMult) stock = Math.round((stock * vt.stockMult) / 100);
        if (family.condition === "remanufactured") stock = Math.min(stock, 14);

        initialStock[vid] = stock;
        variants.push({
          id: vid,
          productId: id,
          sku,
          name: vt.name,
          options: [{ name: vt.optionName, value: vt.name }],
          price,
          compareAtPrice: compareAt,
          cost,
          stockOnHand: stock,
          stockReserved: 0,
          lowStockThreshold: threshold,
          weightGrams: Math.round((family.weight * (vt.weightMult ?? 100)) / 100),
          barcode: ean13(sku),
          imageId: images[0]?.id,
          isActive: true,
          isDefault: Boolean(vt.isDefault) || (vi === 0 && !family.variants.some((v) => v.isDefault)),
          sortOrder: vi,
          createdAt,
          updatedAt,
        });

        movementSeq++;
        movements.push({
          id: `inv_${pad(movementSeq, 5)}`,
          variantId: vid,
          productId: id,
          delta: stock,
          reservedDelta: 0,
          reason: "initial",
          reference: "SEED",
          note: "Opening stock",
          actor: { ...SYSTEM_ACTOR },
          onHandAfter: stock,
          reservedAfter: 0,
          createdAt,
        });
      });

      // Fitment: most of the family's core vehicles
      if (!isUniversal) {
        let chosen = coreConfigs.filter(() => rng.chance(0.82));
        if (chosen.length < 4) chosen = coreConfigs.slice(0, Math.min(4, coreConfigs.length));
        for (const key of chosen) {
          const note = family.notes && rng.chance(0.3) ? rng.pick(family.notes) : undefined;
          for (const v of vehicles.byConfig.get(key) ?? []) {
            fitment.push({ id: `fit_${pad(seq, 3)}_${v.id.slice(4)}`, productId: id, vehicleId: v.id, ...(note ? { note } : {}) });
          }
        }
      }

      built.push({ product, variants, family, offer, initialStock });
    });
  }

  return {
    built,
    products: built.map((b) => b.product),
    variants: built.flatMap((b) => b.variants),
    fitment,
    movements,
    artJobs,
  };
}
