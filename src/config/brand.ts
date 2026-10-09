import type { LocalizedString } from "@/lib/i18n-string";

/**
 * Single source of truth for brand identity. Rename the store here (and re-run `npm run brand:assets`
 * if the wordmark geometry changes). Everything user-visible that is NOT data should read from here
 * or from messages; nothing else should hard-code the store name.
 */
export const brand = {
  /** Short display name, set in the wordmark. */
  name: "APEXLINE",
  /** Full trading name used in titles, emails, invoices. */
  fullName: "APEXLINE Auto Parts",
  descriptor: "AUTO PARTS",
  tagline: {
    en: "Precision parts. Zero guesswork.",
    tr: "Hassas parçalar. Sıfır tahmin.",
  } satisfies LocalizedString,
  description: {
    en: "Brake, engine, suspension and electrical parts matched to your exact vehicle, shipped from stock.",
    tr: "Fren, motor, süspansiyon ve elektrik parçaları aracınıza tam uyumlu, stoktan hızlı gönderim.",
  } satisfies LocalizedString,
  /** Used for the legal entity on invoices and in the footer. */
  legalEntity: "Apexline Automotive Supply Ltd.",
  contact: {
    email: "support@apexline.example",
    ordersEmail: "orders@apexline.example",
    phone: "+1 (555) 013-0420",
    whatsapp: "+15550130420",
    hours: {
      en: "Mon-Fri 08:00-18:00, Sat 09:00-14:00 (UTC)",
      tr: "Pzt-Cum 08:00-18:00, Cmt 09:00-14:00 (UTC)",
    } satisfies LocalizedString,
    address: {
      line1: "1200 Foundry Row",
      city: "Detroit",
      region: "MI",
      postalCode: "48207",
      country: "US",
    },
  },
  socials: {
    instagram: "https://instagram.com/apexline.parts",
    youtube: "https://youtube.com/@apexlineparts",
    x: "https://x.com/apexlineparts",
    facebook: "https://facebook.com/apexlineparts",
  },
  /** Brand colors mirrored from globals.css for places that cannot read CSS variables (OG image, emails, SVG files). */
  colors: {
    graphite: "#14171c",
    steel: "#2b313a",
    orange: "#ff5a1f",
    amber: "#ffb020",
    paper: "#f4f5f7",
  },
} as const;

export type Brand = typeof brand;
