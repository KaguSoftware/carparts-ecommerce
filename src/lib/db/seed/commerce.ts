import { brand } from "@/config/brand";
import type { Coupon, ShippingMethod, StoreSettings, TaxRate } from "@/lib/types/domain";
import { categoryId } from "./categories";
import { DAY, L, type SeedClock } from "./util";

export const TRY_PER_USD = 45;
export const ORDER_PREFIX = "AX-";
export const FIRST_ORDER_NUMBER = 100450;

export const SHIPPABLE_COUNTRIES = ["US", "CA", "GB", "DE", "FR", "NL", "ES", "IT", "TR"];

/* ------------------------------------------------------------------ shipping */

export function buildShippingMethods(clock: SeedClock): ShippingMethod[] {
  const base = { createdAt: clock.ago(400 * DAY), updatedAt: clock.ago(60 * DAY) };
  return [
    {
      id: "shp_standard",
      code: "standard",
      name: L("Standard Ground", "Standart Kara Kargo"),
      description: L("Tracked delivery in 3-6 business days. Free over $99.", "Takip edilebilir teslimat, 3-6 iş günü. 99 $ üzeri ücretsiz."),
      countries: ["US", "CA"],
      price: 799,
      perKgPrice: 150,
      freeOverSubtotal: 9900,
      estimatedDaysMin: 3,
      estimatedDaysMax: 6,
      isActive: true,
      sortOrder: 0,
      ...base,
    },
    {
      id: "shp_express",
      code: "express",
      name: L("Express 2-Day", "Ekspres 2 Gün"),
      description: L("Priority handling and delivery in 1-2 business days.", "Öncelikli işlem ve 1-2 iş gününde teslimat."),
      countries: ["US"],
      price: 1999,
      perKgPrice: 250,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      isActive: true,
      sortOrder: 1,
      ...base,
    },
    {
      id: "shp_pickup",
      code: "pickup",
      name: L("Warehouse Pickup (Detroit)", "Depodan Teslim Alma (Detroit)"),
      description: L("Collect from our Detroit warehouse, usually ready within 2 hours.", "Detroit deposundan teslim alın, genellikle 2 saat içinde hazır."),
      countries: ["US"],
      price: 0,
      perKgPrice: 0,
      estimatedDaysMin: 0,
      estimatedDaysMax: 1,
      isActive: true,
      sortOrder: 2,
      ...base,
    },
    {
      id: "shp_international",
      code: "international",
      name: L("International Economy", "Uluslararası Ekonomik"),
      description: L("Tracked economy shipping to the UK and EU in 7-14 business days.", "Birleşik Krallık ve AB'ye takipli ekonomik gönderim, 7-14 iş günü."),
      countries: ["GB", "DE", "FR", "NL", "ES", "IT"],
      price: 2499,
      perKgPrice: 400,
      freeOverSubtotal: 29900,
      estimatedDaysMin: 7,
      estimatedDaysMax: 14,
      isActive: true,
      sortOrder: 3,
      ...base,
    },
    {
      id: "shp_tr_standard",
      code: "tr-standard",
      name: L("Türkiye Standard Courier", "Türkiye Standart Kargo"),
      description: L("Domestic courier delivery in 2-4 business days. Free over $75.", "Yurt içi kargo, 2-4 iş günü. 75 $ üzeri ücretsiz."),
      countries: ["TR"],
      price: 499,
      perKgPrice: 100,
      freeOverSubtotal: 7500,
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
      isActive: true,
      sortOrder: 4,
      ...base,
    },
    {
      id: "shp_tr_express",
      code: "tr-express",
      name: L("Türkiye Express Courier", "Türkiye Ekspres Kargo"),
      description: L("Next-business-day delivery to major cities.", "Büyük şehirlere bir sonraki iş günü teslimat."),
      countries: ["TR"],
      price: 999,
      perKgPrice: 150,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      isActive: true,
      sortOrder: 5,
      ...base,
    },
  ];
}

/* ------------------------------------------------------------------ tax */

export function buildTaxRates(clock: SeedClock): TaxRate[] {
  const base = { createdAt: clock.ago(400 * DAY), updatedAt: clock.ago(90 * DAY) };
  const us = (region: string, bps: number, name: string): TaxRate => ({
    id: `tax_us_${region.toLowerCase()}`,
    name: L(`Sales tax (${name})`, `Satış vergisi (${name})`),
    country: "US",
    region,
    rateBps: bps,
    appliesToShipping: region === "TX" || region === "NY",
    isActive: true,
    ...base,
  });
  const vat = (country: string, bps: number, en: string, tr: string): TaxRate => ({
    id: `tax_${country.toLowerCase()}`,
    name: L(en, tr),
    country,
    region: "",
    rateBps: bps,
    appliesToShipping: true,
    isActive: true,
    ...base,
  });
  return [
    us("CA", 725, "CA"),
    us("NY", 800, "NY"),
    us("TX", 625, "TX"),
    us("MI", 600, "MI"),
    us("FL", 600, "FL"),
    us("WA", 650, "WA"),
    vat("CA", 500, "GST (Canada)", "GST (Kanada)"),
    vat("GB", 2000, "VAT (UK)", "KDV (Birleşik Krallık)"),
    vat("DE", 1900, "VAT (Germany)", "KDV (Almanya)"),
    vat("FR", 2000, "VAT (France)", "KDV (Fransa)"),
    vat("NL", 2100, "VAT (Netherlands)", "KDV (Hollanda)"),
    vat("ES", 2100, "VAT (Spain)", "KDV (İspanya)"),
    vat("IT", 2200, "VAT (Italy)", "KDV (İtalya)"),
    vat("TR", 2000, "VAT (Türkiye)", "KDV (Türkiye)"),
  ];
}

/* ------------------------------------------------------------------ coupons */

export interface CouponSeed {
  coupon: Coupon;
  /** Redemptions that happened before the seeded orders (adds to usedCount only). */
  historicalUses: number;
}

export function buildCoupons(clock: SeedClock): CouponSeed[] {
  const base = (days: number) => ({ createdAt: clock.ago(days * DAY), updatedAt: clock.ago(Math.max(1, days - 20) * DAY) });
  const mk = (c: Omit<Coupon, "createdAt" | "updatedAt" | "usedCount">, days: number, historicalUses = 0): CouponSeed => ({
    coupon: { ...c, usedCount: 0, ...base(days) },
    historicalUses,
  });
  return [
    mk({ id: "cpn_welcome10", code: "WELCOME10", description: L("10% off your first order", "İlk siparişinizde %10 indirim"), type: "percent", value: 10, perUserLimit: 1, isActive: true }, 300, 128),
    mk({ id: "cpn_save25", code: "SAVE25", description: L("$25 off orders over $150", "150 $ üzeri siparişlerde 25 $ indirim"), type: "fixed", value: 2500, minSubtotal: 15000, isActive: true }, 200, 41),
    mk({ id: "cpn_freeship", code: "FREESHIP", description: L("Free shipping on orders over $75", "75 $ üzeri siparişlerde ücretsiz kargo"), type: "free_shipping", value: 0, minSubtotal: 7500, isActive: true }, 180, 76),
    mk(
      {
        id: "cpn_brakes15",
        code: "BRAKES15",
        description: L("15% off brake parts, up to $40", "Fren parçalarında %15 indirim, en fazla 40 $"),
        type: "percent",
        value: 15,
        maxDiscount: 4000,
        appliesTo: { categoryIds: [categoryId("brakes")] },
        startsAt: clock.ago(10 * DAY),
        endsAt: clock.ahead(20 * DAY),
        isActive: true,
      },
      12,
      9,
    ),
    mk(
      {
        id: "cpn_vip20",
        code: "VIP20",
        description: L("VIP members: 20% off, up to $60", "VIP üyelere özel: %20 indirim, en fazla 60 $"),
        type: "percent",
        value: 20,
        maxDiscount: 6000,
        usageLimit: 50,
        perUserLimit: 1,
        isActive: true,
      },
      150,
      44,
    ),
    mk(
      {
        id: "cpn_filters10",
        code: "FILTERS10",
        description: L("10% off filters and fluids", "Filtre ve sıvılarda %10 indirim"),
        type: "percent",
        value: 10,
        appliesTo: { categoryIds: [categoryId("filters"), categoryId("fluids")] },
        isActive: true,
      },
      90,
      17,
    ),
    mk(
      {
        id: "cpn_spring20",
        code: "SPRING20",
        description: L("Spring sale: 20% off (ended)", "Bahar indirimi: %20 (sona erdi)"),
        type: "percent",
        value: 20,
        startsAt: clock.ago(75 * DAY),
        endsAt: clock.ago(40 * DAY),
        isActive: true,
      },
      80,
      212,
    ),
    mk(
      {
        id: "cpn_blackfriday",
        code: "BLACKFRIDAY",
        description: L("Black Friday: 25% off (scheduled)", "Efsane Cuma: %25 indirim (zamanlanmış)"),
        type: "percent",
        value: 25,
        maxDiscount: 10000,
        startsAt: clock.ahead(45 * DAY),
        endsAt: clock.ahead(48 * DAY),
        isActive: true,
      },
      5,
    ),
    mk(
      {
        id: "cpn_flash30",
        code: "FLASH30",
        description: L("Flash sale: 30% off, limited to 40 uses", "Flaş indirim: %30, 40 kullanımla sınırlı"),
        type: "percent",
        value: 30,
        maxDiscount: 8000,
        usageLimit: 40,
        isActive: true,
      },
      60,
      40,
    ),
    mk({ id: "cpn_olddeal", code: "OLDDEAL", description: L("Retired 5% promotion", "Sonlandırılmış %5 kampanya"), type: "percent", value: 5, isActive: false }, 365, 301),
  ];
}

/* ------------------------------------------------------------------ settings */

export function buildSettings(clock: SeedClock, nextOrderNumber: number): StoreSettings {
  return {
    id: "settings",
    store: {
      name: brand.fullName,
      legalEntity: brand.legalEntity,
      email: brand.contact.email,
      phone: brand.contact.phone,
      address: { ...brand.contact.address },
      taxId: "US-47-1234567",
    },
    currency: { base: "USD", tryPerUsd: TRY_PER_USD },
    checkout: {
      guestCheckout: true,
      orderNumberPrefix: ORDER_PREFIX,
      nextOrderNumber,
      maxQuantityPerLine: 10,
      freeShippingThreshold: 9900,
      defaultCountry: "US",
      shippableCountries: SHIPPABLE_COUNTRIES,
      reservationMinutes: 30,
    },
    inventory: { defaultLowStockThreshold: 5, allowBackorders: false },
    seo: {
      defaultTitle: L(`${brand.fullName} - ${brand.tagline.en}`, `${brand.fullName} - ${brand.tagline.tr}`),
      defaultDescription: brand.description,
    },
    social: { ...brand.socials },
    maintenanceMode: false,
    emails: { orderConfirmation: true, shippingUpdate: true, adminNewOrder: true, adminAddress: brand.contact.ordersEmail },
    createdAt: clock.ago(420 * DAY),
    updatedAt: clock.ago(12 * DAY),
  };
}

