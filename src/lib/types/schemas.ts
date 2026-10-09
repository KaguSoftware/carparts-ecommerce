/**
 * Zod schemas for every persisted entity in `domain.ts` (client-safe: depends only on zod).
 *
 * Each schema is declared `satisfies z.ZodType<Entity>`, so the compiler fails when a schema drifts from the
 * TypeScript contract. They validate *stored* rows (seed integrity tests, import tooling, a future DB
 * migration); user input is validated by the per-action schemas built from `@/lib/validation/common`.
 * Persisted shapes are strict: unknown keys are rejected so typos in seed data surface immediately.
 */
import { z } from "zod";
import { LOCALES } from "@/i18n/routing";
import type { CollectionMap, CollectionName } from "@/lib/db/contracts";
import type {
  Actor,
  Address,
  AuditEntry,
  Banner,
  Brand,
  Cart,
  Category,
  CmsPage,
  ContactMessage,
  Coupon,
  FitmentRow,
  InventoryMovement,
  NewsletterSubscriber,
  Order,
  Payment,
  Product,
  ProductVariant,
  Review,
  ShippingMethod,
  StoreSettings,
  TaxRate,
  User,
  Vehicle,
  VehicleMake,
  VehicleModel,
  Wishlist,
} from "./domain";

/* ------------------------------------------------------------------ primitives */

export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date_invalid");
/** Integer USD cents (may be negative only where explicitly allowed, e.g. inventory deltas use plain ints). */
export const centsSchema = z.number().int().min(0);
const int = z.number().int();
const nonNegInt = z.number().int().min(0);
const localeSchema = z.enum(LOCALES);
const localizedSchema = z.strictObject({ en: z.string(), tr: z.string() });
const timestamps = { createdAt: isoDateSchema, updatedAt: isoDateSchema };
const ratingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const currencySchema = z.enum(["USD", "TRY"]);

export const actorSchema = z.strictObject({
  id: z.string().min(1),
  email: z.string().optional(),
  role: z.enum(["customer", "staff", "admin", "system"]),
  ip: z.string().optional(),
}) satisfies z.ZodType<Actor>;

/* ------------------------------------------------------------------ users & auth */

export const userSchema = z.strictObject({
  id: idSchema,
  email: z.string().email(),
  emailVerified: z.boolean(),
  name: z.string().min(1),
  image: z.string().nullish(),
  role: z.enum(["customer", "staff", "admin"]),
  phone: z.string().nullish(),
  locale: localeSchema,
  disabled: z.boolean(),
  marketingOptIn: z.boolean(),
  lastLoginAt: isoDateSchema.nullish(),
  ...timestamps,
}) satisfies z.ZodType<User>;

export const addressSchema = z.strictObject({
  id: idSchema,
  userId: idSchema,
  label: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  region: z.string(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().min(1),
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
}) satisfies z.ZodType<Address>;

const addressInputSchema = z.strictObject({
  label: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  region: z.string(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().min(1),
});

/* ------------------------------------------------------------------ catalog */

export const categorySchema = z.strictObject({
  id: idSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: idSchema.nullable(),
  name: localizedSchema,
  description: localizedSchema,
  image: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: int,
  isActive: z.boolean(),
  seoTitle: localizedSchema.optional(),
  seoDescription: localizedSchema.optional(),
  ...timestamps,
}) satisfies z.ZodType<Category>;

export const brandSchema = z.strictObject({
  id: idSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: localizedSchema,
  logo: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: int,
  ...timestamps,
}) satisfies z.ZodType<Brand>;

const productImageSchema = z.strictObject({ id: idSchema, url: z.string().min(1), alt: localizedSchema, sortOrder: int });
const productSpecSchema = z.strictObject({ key: localizedSchema, value: localizedSchema });

export const productSchema = z.strictObject({
  id: idSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: localizedSchema,
  summary: localizedSchema,
  description: localizedSchema,
  brandId: idSchema,
  categoryId: idSchema,
  categoryIds: z.array(idSchema).min(1),
  images: z.array(productImageSchema),
  specs: z.array(productSpecSchema),
  tags: z.array(z.string()),
  status: z.enum(["draft", "active", "archived"]),
  isFeatured: z.boolean(),
  partNumber: z.string().min(1),
  oemNumbers: z.array(z.string()),
  warrantyMonths: nonNegInt,
  fitment: z.enum(["universal", "specific"]),
  ratingAverage: z.number().min(0).max(5),
  ratingCount: nonNegInt,
  soldCount: nonNegInt,
  seoTitle: localizedSchema.optional(),
  seoDescription: localizedSchema.optional(),
  ...timestamps,
}) satisfies z.ZodType<Product>;

export const variantSchema = z.strictObject({
  id: idSchema,
  productId: idSchema,
  sku: z.string().min(1),
  name: localizedSchema,
  options: z.array(z.strictObject({ name: localizedSchema, value: localizedSchema })),
  price: centsSchema,
  compareAtPrice: centsSchema.optional(),
  cost: centsSchema.optional(),
  stockOnHand: nonNegInt,
  stockReserved: nonNegInt,
  lowStockThreshold: nonNegInt,
  weightGrams: nonNegInt,
  barcode: z.string().optional(),
  imageId: idSchema.optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: int,
  ...timestamps,
}) satisfies z.ZodType<ProductVariant>;

/* ------------------------------------------------------------------ vehicles & fitment */

export const vehicleMakeSchema = z.strictObject({ id: idSchema, slug: z.string().min(1), name: z.string().min(1) }) satisfies z.ZodType<VehicleMake>;
export const vehicleModelSchema = z.strictObject({
  id: idSchema,
  makeId: idSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
}) satisfies z.ZodType<VehicleModel>;
export const vehicleSchema = z.strictObject({
  id: idSchema,
  makeId: idSchema,
  modelId: idSchema,
  year: z.number().int().min(1950).max(2100),
  engine: z.string().min(1),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric", "lpg"]),
  bodyType: z.string().optional(),
}) satisfies z.ZodType<Vehicle>;
export const fitmentSchema = z.strictObject({
  id: idSchema,
  productId: idSchema,
  vehicleId: idSchema,
  note: localizedSchema.optional(),
}) satisfies z.ZodType<FitmentRow>;

/* ------------------------------------------------------------------ inventory & reviews */

export const inventoryMovementSchema = z.strictObject({
  id: idSchema,
  variantId: idSchema,
  productId: idSchema,
  delta: int,
  reservedDelta: int,
  reason: z.enum(["initial", "purchase", "sale", "adjustment", "return", "reservation", "release", "damage", "correction"]),
  reference: z.string().optional(),
  note: z.string().optional(),
  actor: actorSchema,
  onHandAfter: nonNegInt,
  reservedAfter: nonNegInt,
  createdAt: isoDateSchema,
}) satisfies z.ZodType<InventoryMovement>;

export const reviewSchema = z.strictObject({
  id: idSchema,
  productId: idSchema,
  userId: idSchema.nullable(),
  authorName: z.string().min(1),
  rating: ratingSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  locale: localeSchema,
  status: z.enum(["pending", "approved", "rejected"]),
  verifiedPurchase: z.boolean(),
  helpfulCount: nonNegInt,
  adminReply: z.strictObject({ body: z.string(), at: isoDateSchema, by: z.string() }).optional(),
  ...timestamps,
}) satisfies z.ZodType<Review>;

/* ------------------------------------------------------------------ cart, coupons, shipping, tax */

export const cartSchema = z.strictObject({
  id: idSchema,
  userId: idSchema.nullable(),
  items: z.array(
    z.strictObject({ variantId: idSchema, quantity: z.number().int().min(1), addedAt: isoDateSchema, priceAtAdd: centsSchema }),
  ),
  couponCode: z.string().optional(),
  expiresAt: isoDateSchema,
  ...timestamps,
}) satisfies z.ZodType<Cart>;

export const couponSchema = z.strictObject({
  id: idSchema,
  code: z.string().regex(/^[A-Z0-9_-]+$/),
  description: localizedSchema,
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: nonNegInt,
  minSubtotal: centsSchema.optional(),
  maxDiscount: centsSchema.optional(),
  startsAt: isoDateSchema.optional(),
  endsAt: isoDateSchema.optional(),
  usageLimit: nonNegInt.optional(),
  perUserLimit: nonNegInt.optional(),
  usedCount: nonNegInt,
  appliesTo: z
    .strictObject({ categoryIds: z.array(idSchema).optional(), brandIds: z.array(idSchema).optional(), productIds: z.array(idSchema).optional() })
    .optional(),
  isActive: z.boolean(),
  ...timestamps,
}) satisfies z.ZodType<Coupon>;

export const couponRedemptionSchema = z.strictObject({
  id: idSchema,
  couponId: idSchema,
  orderId: idSchema,
  userId: idSchema.nullable(),
  email: z.string(),
  at: isoDateSchema,
});

export const shippingMethodSchema = z.strictObject({
  id: idSchema,
  code: z.string().min(1),
  name: localizedSchema,
  description: localizedSchema,
  countries: z.array(z.string().min(1)).min(1),
  price: centsSchema,
  perKgPrice: centsSchema,
  freeOverSubtotal: centsSchema.optional(),
  estimatedDaysMin: nonNegInt,
  estimatedDaysMax: nonNegInt,
  isActive: z.boolean(),
  sortOrder: int,
  ...timestamps,
}) satisfies z.ZodType<ShippingMethod>;

export const taxRateSchema = z.strictObject({
  id: idSchema,
  name: localizedSchema,
  country: z.string().length(2),
  region: z.string(),
  rateBps: nonNegInt,
  appliesToShipping: z.boolean(),
  isActive: z.boolean(),
  ...timestamps,
}) satisfies z.ZodType<TaxRate>;

/* ------------------------------------------------------------------ orders & payments */

const orderStatusSchema = z.enum(["pending_payment", "processing", "shipped", "delivered", "cancelled", "refunded"]);

const orderItemSchema = z.strictObject({
  id: idSchema,
  productId: idSchema,
  variantId: idSchema,
  sku: z.string().min(1),
  name: localizedSchema,
  variantName: localizedSchema,
  brandName: z.string(),
  image: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: centsSchema,
  discount: centsSchema,
  tax: centsSchema,
  lineTotal: centsSchema,
  refundedQuantity: nonNegInt,
});

export const orderSchema = z.strictObject({
  id: idSchema,
  number: z.string().min(1),
  userId: idSchema.nullable(),
  email: z.string().email(),
  status: orderStatusSchema,
  paymentStatus: z.enum(["unpaid", "paid", "failed", "partially_refunded", "refunded"]),
  items: z.array(orderItemSchema).min(1),
  shippingAddress: addressInputSchema,
  billingAddress: addressInputSchema,
  shippingMethod: z.strictObject({
    id: idSchema,
    code: z.string(),
    name: localizedSchema,
    price: centsSchema,
    estimatedDaysMin: nonNegInt,
    estimatedDaysMax: nonNegInt,
  }),
  couponCode: z.string().optional(),
  subtotal: centsSchema,
  discount: centsSchema,
  shipping: centsSchema,
  tax: centsSchema,
  total: centsSchema,
  currency: currencySchema,
  fxRate: z.number().positive(),
  chargedTotal: nonNegInt,
  refundedTotal: centsSchema,
  locale: localeSchema,
  customerNote: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  shippedAt: isoDateSchema.optional(),
  deliveredAt: isoDateSchema.optional(),
  accessToken: z.string().min(16),
  idempotencyKey: z.string().min(1),
  events: z.array(
    z.strictObject({
      id: idSchema,
      at: isoDateSchema,
      type: z.enum(["created", "paid", "payment_failed", "status_changed", "note", "shipped", "refund", "cancelled", "email_sent"]),
      status: orderStatusSchema.optional(),
      message: z.string().optional(),
      actor: actorSchema,
    }),
  ),
  internalNotes: z.array(z.strictObject({ id: idSchema, at: isoDateSchema, by: z.string(), body: z.string() })),
  paymentId: idSchema.optional(),
  cartId: idSchema.optional(),
  ...timestamps,
}) satisfies z.ZodType<Order>;

const refundSchema = z.strictObject({
  id: idSchema,
  at: isoDateSchema,
  amount: centsSchema,
  amountCharged: nonNegInt,
  reason: z.string(),
  providerRef: z.string(),
  items: z.array(z.strictObject({ orderItemId: idSchema, quantity: z.number().int().min(1) })).optional(),
  includesShipping: z.boolean().optional(),
  restock: z.boolean(),
  actor: actorSchema,
});

export const paymentSchema = z.strictObject({
  id: idSchema,
  orderId: idSchema,
  provider: z.enum(["mock", "stripe"]),
  providerRef: z.string().min(1),
  amount: nonNegInt,
  currency: currencySchema,
  status: z.enum(["requires_payment_method", "requires_action", "succeeded", "failed", "cancelled"]),
  method: z.strictObject({ brand: z.string(), last4: z.string().length(4), expMonth: z.number().int().min(1).max(12), expYear: int }).optional(),
  failureCode: z.string().optional(),
  refunds: z.array(refundSchema),
  ...timestamps,
}) satisfies z.ZodType<Payment>;

/* ------------------------------------------------------------------ marketing & content */

export const wishlistSchema = z.strictObject({
  id: idSchema,
  userId: idSchema,
  productIds: z.array(idSchema),
  updatedAt: isoDateSchema,
}) satisfies z.ZodType<Wishlist>;

export const cmsPageSchema = z.strictObject({
  id: idSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: localizedSchema,
  body: localizedSchema,
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  sortOrder: int,
  seoDescription: localizedSchema.optional(),
  ...timestamps,
}) satisfies z.ZodType<CmsPage>;

export const bannerSchema = z.strictObject({
  id: idSchema,
  placement: z.enum(["home_hero", "home_promo", "announcement", "category_top"]),
  title: localizedSchema,
  subtitle: localizedSchema,
  ctaLabel: localizedSchema,
  ctaHref: z.string().min(1),
  image: z.string().optional(),
  tone: z.enum(["dark", "orange", "light"]),
  startsAt: isoDateSchema.optional(),
  endsAt: isoDateSchema.optional(),
  isActive: z.boolean(),
  sortOrder: int,
  ...timestamps,
}) satisfies z.ZodType<Banner>;

export const newsletterSchema = z.strictObject({
  id: idSchema,
  email: z.string().email(),
  locale: localeSchema,
  source: z.string(),
  subscribedAt: isoDateSchema,
  unsubscribedAt: isoDateSchema.optional(),
}) satisfies z.ZodType<NewsletterSubscriber>;

export const contactMessageSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
  orderNumber: z.string().optional(),
  locale: localeSchema,
  status: z.enum(["new", "read", "replied", "archived"]),
  adminNotes: z.string().optional(),
  ...timestamps,
}) satisfies z.ZodType<ContactMessage>;

/* ------------------------------------------------------------------ settings, audit, misc */

export const settingsSchema = z.strictObject({
  id: z.literal("settings"),
  store: z.strictObject({
    name: z.string().min(1),
    legalEntity: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    address: z.strictObject({ line1: z.string(), city: z.string(), region: z.string(), postalCode: z.string(), country: z.string().length(2) }),
    taxId: z.string().optional(),
  }),
  currency: z.strictObject({ base: z.literal("USD"), tryPerUsd: z.number().positive() }),
  checkout: z.strictObject({
    guestCheckout: z.boolean(),
    orderNumberPrefix: z.string(),
    nextOrderNumber: z.number().int().min(1),
    maxQuantityPerLine: z.number().int().min(1),
    freeShippingThreshold: centsSchema,
    defaultCountry: z.string().length(2),
    shippableCountries: z.array(z.string().length(2)),
    reservationMinutes: z.number().int().min(1),
  }),
  inventory: z.strictObject({ defaultLowStockThreshold: nonNegInt, allowBackorders: z.boolean() }),
  seo: z.strictObject({ defaultTitle: localizedSchema, defaultDescription: localizedSchema }),
  social: z.strictObject({
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    x: z.string().optional(),
    facebook: z.string().optional(),
  }),
  maintenanceMode: z.boolean(),
  emails: z.strictObject({ orderConfirmation: z.boolean(), shippingUpdate: z.boolean(), adminNewOrder: z.boolean(), adminAddress: z.string() }),
  ...timestamps,
}) satisfies z.ZodType<StoreSettings>;

export const auditEntrySchema = z.strictObject({
  id: idSchema,
  at: isoDateSchema,
  actor: actorSchema,
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string(),
  summary: z.string(),
  changes: z.record(z.string(), z.strictObject({ from: z.unknown(), to: z.unknown() })).optional(),
}) satisfies z.ZodType<AuditEntry>;

const searchLogSchema = z.strictObject({ id: idSchema, q: z.string(), resultCount: nonNegInt, at: isoDateSchema });
const reviewVoteSchema = z.strictObject({ id: idSchema, reviewId: idSchema, voterKey: z.string(), at: isoDateSchema });

const authAccountSchema = z.strictObject({
  id: idSchema,
  userId: idSchema,
  providerId: z.string().min(1),
  accountId: z.string().min(1),
  password: z.string().nullish(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const authSessionSchema = z.strictObject({
  id: idSchema,
  userId: idSchema,
  token: z.string().min(1),
  expiresAt: isoDateSchema,
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const authVerificationSchema = z.strictObject({
  id: idSchema,
  identifier: z.string().min(1),
  value: z.string().min(1),
  expiresAt: isoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const loginAttemptSchema = z.strictObject({
  id: idSchema,
  key: z.string().min(1),
  failures: nonNegInt,
  lockedUntil: isoDateSchema.nullish(),
  updatedAt: isoDateSchema,
});

/** Schema for every collection, keyed exactly like `CollectionMap` (compile-time checked). */
export const collectionSchemas = {
  users: userSchema,
  addresses: addressSchema,
  categories: categorySchema,
  brands: brandSchema,
  products: productSchema,
  variants: variantSchema,
  vehicleMakes: vehicleMakeSchema,
  vehicleModels: vehicleModelSchema,
  vehicles: vehicleSchema,
  fitment: fitmentSchema,
  reviews: reviewSchema,
  carts: cartSchema,
  orders: orderSchema,
  payments: paymentSchema,
  inventoryMovements: inventoryMovementSchema,
  coupons: couponSchema,
  couponRedemptions: couponRedemptionSchema,
  shippingMethods: shippingMethodSchema,
  taxRates: taxRateSchema,
  wishlists: wishlistSchema,
  pages: cmsPageSchema,
  banners: bannerSchema,
  settings: settingsSchema,
  newsletter: newsletterSchema,
  contactMessages: contactMessageSchema,
  auditLog: auditEntrySchema,
  searchLog: searchLogSchema,
  reviewVotes: reviewVoteSchema,
  authAccounts: authAccountSchema,
  authSessions: authSessionSchema,
  authVerifications: authVerificationSchema,
  loginAttempts: loginAttemptSchema,
} satisfies { [K in CollectionName]: z.ZodType<CollectionMap[K]> };
