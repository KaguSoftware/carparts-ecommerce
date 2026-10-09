/**
 * DOMAIN TYPES - the shape of every persisted entity and every DTO crossing the service boundary.
 * Binding contract (ARCHITECTURE.md). Money = integer USD cents. Translatable text = LocalizedString.
 * Timestamps are ISO-8601 UTC strings. Ids are opaque strings (never parse them).
 */
import type { LocalizedString } from "@/lib/i18n-string";
import type { Currency } from "@/lib/money";

export type { LocalizedString, Currency };
export type Id = string;
export type ISODate = string;
/** Integer USD minor units (cents). */
export type Cents = number;

export interface Timestamps {
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ------------------------------------------------------------------ generic */

export interface PageParams {
  page?: number; // 1-based, default 1
  pageSize?: number; // default 24, max 100
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Who performed a mutation. Services write audit entries from it. `system` = seed/cron/webhook. */
export interface Actor {
  id: Id | "system";
  email?: string;
  role: UserRole | "system";
  ip?: string;
}

/* ------------------------------------------------------------------ users & auth */

export type UserRole = "customer" | "staff" | "admin";

export interface User extends Timestamps {
  id: Id;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role: UserRole;
  phone?: string | null;
  /** Preferred storefront language (used for emails). */
  locale: "en" | "tr";
  /** Disabled users cannot sign in. */
  disabled: boolean;
  marketingOptIn: boolean;
  lastLoginAt?: ISODate | null;
}

/** What the UI receives about the signed-in user. Never includes secrets. */
export interface SessionUser {
  id: Id;
  email: string;
  name: string;
  role: UserRole;
  locale: "en" | "tr";
  image?: string | null;
}

export type Permission =
  | "catalog.read"
  | "catalog.write"
  | "inventory.write"
  | "orders.read"
  | "orders.write"
  | "orders.refund"
  | "customers.read"
  | "reviews.moderate"
  | "marketing.write" // coupons, banners, newsletter
  | "cms.write"
  | "settings.write" // store, shipping, tax
  | "users.manage" // staff accounts + roles
  | "audit.read"
  | "dashboard.read";

export interface Address {
  id: Id;
  userId: Id;
  label?: string;
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  phone: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

/** Address as typed in a form / snapshotted on an order (no ownership fields). */
export type AddressInput = Omit<Address, "id" | "userId" | "isDefaultShipping" | "isDefaultBilling">;

/* ------------------------------------------------------------------ catalog */

export interface Category extends Timestamps {
  id: Id;
  slug: string;
  parentId: Id | null;
  name: LocalizedString;
  description: LocalizedString;
  /** Public path under /public, e.g. /products/cat-brakes.svg */
  image?: string;
  icon?: string; // lucide icon name used by storefront nav
  sortOrder: number;
  isActive: boolean;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
  /** Active products in this category and descendants */
  productCount: number;
}

export interface Brand extends Timestamps {
  id: Id;
  slug: string;
  name: string; // brand names are not translated
  description: LocalizedString;
  logo?: string;
  country?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ProductImage {
  id: Id;
  url: string; // /products/xyz.svg or /uploads/xyz.webp
  alt: LocalizedString;
  sortOrder: number;
}

export interface ProductSpec {
  key: LocalizedString; // e.g. {en:"Pad thickness", tr:"Balata kalinligi"}
  value: LocalizedString; // e.g. {en:"17.5 mm", tr:"17,5 mm"}
}

export type ProductStatus = "draft" | "active" | "archived";

export interface Product extends Timestamps {
  id: Id;
  slug: string;
  name: LocalizedString;
  summary: LocalizedString; // 1-2 sentences, cards & meta description
  description: LocalizedString; // markdown
  brandId: Id;
  categoryId: Id; // primary category
  categoryIds: Id[]; // all categories incl. primary
  images: ProductImage[];
  specs: ProductSpec[];
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  /** Manufacturer part number */
  partNumber: string;
  oemNumbers: string[];
  warrantyMonths: number;
  /** universal = fits any vehicle; specific = fits only vehicles in the fitment table */
  fitment: "universal" | "specific";
  /** Denormalised from approved reviews; maintained by the reviews service. */
  ratingAverage: number; // 0-5, one decimal
  ratingCount: number;
  /** Denormalised units sold; maintained by the orders service. */
  soldCount: number;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
}

export interface VariantOption {
  name: LocalizedString; // "Position"
  value: LocalizedString; // "Front axle"
}

export interface ProductVariant extends Timestamps {
  id: Id;
  productId: Id;
  sku: string; // unique
  name: LocalizedString; // short label shown in the selector, e.g. "Front axle, pair"
  options: VariantOption[];
  price: Cents;
  compareAtPrice?: Cents; // strike-through "was" price
  cost?: Cents; // admin only
  /** Physical units on hand (including reserved). */
  stockOnHand: number;
  /** Units held by unpaid checkouts / open carts at payment time. */
  stockReserved: number;
  lowStockThreshold: number;
  weightGrams: number;
  barcode?: string;
  imageId?: Id; // one of product.images
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** Variant plus derived availability. `available = stockOnHand - stockReserved` (never < 0). */
export interface VariantView extends ProductVariant {
  available: number;
  stockStatus: StockStatus;
}

/** Card/list projection: everything a product grid needs, no extra fetches. */
export interface ProductSummary {
  id: Id;
  slug: string;
  name: LocalizedString;
  summary: LocalizedString;
  brand: { id: Id; slug: string; name: string };
  category: { id: Id; slug: string; name: LocalizedString };
  image?: ProductImage;
  secondImage?: ProductImage;
  partNumber: string;
  /** Up to three short spec values ("17.5 mm", "Ceramic") for the mono spec strip on cards. */
  highlights: LocalizedString[];
  /** Lowest active variant price */
  priceFrom: Cents;
  compareAtFrom?: Cents;
  hasMultiplePrices: boolean;
  defaultVariantId: Id;
  variantCount: number;
  stockStatus: StockStatus;
  ratingAverage: number;
  ratingCount: number;
  isFeatured: boolean;
  /** Present when a vehicle filter is active: does this product fit it? */
  fitsSelectedVehicle?: boolean;
  createdAt: ISODate;
}

export interface ProductDetail {
  product: Product;
  brand: Brand;
  category: Category;
  /** Breadcrumb trail root -> primary category */
  categoryPath: Category[];
  variants: VariantView[];
  defaultVariantId: Id;
  fitmentCount: number;
  related: ProductSummary[];
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

/* ------------------------------------------------------------------ vehicles & fitment */

export interface VehicleMake {
  id: Id;
  slug: string;
  name: string;
}
export interface VehicleModel {
  id: Id;
  makeId: Id;
  slug: string;
  name: string;
}
/** One concrete vehicle configuration (a specific make/model/year/engine). */
export interface Vehicle {
  id: Id;
  makeId: Id;
  modelId: Id;
  year: number;
  /** Display engine label, e.g. "2.0 TDI 150 hp" */
  engine: string;
  fuel: "petrol" | "diesel" | "hybrid" | "electric" | "lpg";
  bodyType?: string;
}
export interface VehicleView extends Vehicle {
  make: VehicleMake;
  model: VehicleModel;
  /** "2019 BMW 3 Series 2.0 L" - locale independent */
  label: string;
}

/** A product fits a vehicle. Absent rows for `fitment: "specific"` products mean "does not fit". */
export interface FitmentRow {
  id: Id;
  productId: Id;
  vehicleId: Id;
  note?: LocalizedString; // e.g. "Front axle only"
}

/** What the visitor selected in "Find parts for your car". Stored in the `vehicle` cookie. */
export interface VehicleSelection {
  makeId?: Id;
  modelId?: Id;
  year?: number;
  /** Set once the engine is chosen; identifies one exact Vehicle. */
  vehicleId?: Id;
}

export type FitmentResult = { status: "fits"; note?: LocalizedString } | { status: "does_not_fit" } | { status: "universal" } | { status: "unknown" };

/* ------------------------------------------------------------------ inventory */

export type InventoryReason = "initial" | "purchase" | "sale" | "adjustment" | "return" | "reservation" | "release" | "damage" | "correction";

export interface InventoryMovement {
  id: Id;
  variantId: Id;
  productId: Id;
  delta: number; // signed change in stockOnHand (reservation/release change stockReserved and have delta = 0 + reservedDelta)
  reservedDelta: number;
  reason: InventoryReason;
  reference?: string; // order number, PO number...
  note?: string;
  actor: Actor;
  onHandAfter: number;
  reservedAfter: number;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ reviews */

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review extends Timestamps {
  id: Id;
  productId: Id;
  userId: Id | null;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  locale: "en" | "tr";
  status: ReviewStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: { body: string; at: ISODate; by: string };
}

/* ------------------------------------------------------------------ cart */

export interface CartItem {
  variantId: Id;
  quantity: number;
  addedAt: ISODate;
  /** Unit price when added; used only to warn about price changes. */
  priceAtAdd: Cents;
}

export interface Cart extends Timestamps {
  id: Id;
  userId: Id | null;
  items: CartItem[];
  couponCode?: string;
  expiresAt: ISODate;
}

export type CartWarning =
  | { type: "price_changed"; variantId: Id; from: Cents; to: Cents }
  | { type: "quantity_reduced"; variantId: Id; requested: number; available: number }
  | { type: "item_removed"; variantId: Id; reason: "unavailable" | "out_of_stock" }
  | { type: "coupon_removed"; code: string; reason: string };

export interface CartLine {
  variantId: Id;
  productId: Id;
  slug: string;
  sku: string;
  /** Manufacturer part number of the product (the variant SKU is the orderable code). */
  partNumber: string;
  name: LocalizedString;
  variantName: LocalizedString;
  brandName: string;
  image?: string;
  quantity: number;
  unitPrice: Cents;
  compareAtPrice?: Cents;
  lineTotal: Cents;
  available: number;
  maxQuantity: number; // min(available, 10 per line cap from settings)
}

export interface CartTotals {
  subtotal: Cents;
  discount: Cents;
  shipping: Cents; // 0 until a method is chosen
  tax: Cents;
  total: Cents;
  itemCount: number;
  /** Amount left to reach free shipping, or 0 */
  freeShippingRemaining: Cents;
}

export interface CartView {
  id: Id;
  lines: CartLine[];
  coupon?: { code: string; type: CouponType; discount: Cents; freeShipping: boolean };
  totals: CartTotals;
  warnings: CartWarning[];
}

/* ------------------------------------------------------------------ coupons / shipping / tax */

export type CouponType = "percent" | "fixed" | "free_shipping";

export interface Coupon extends Timestamps {
  id: Id;
  code: string; // stored UPPERCASE, unique
  description: LocalizedString;
  type: CouponType;
  /** percent: 1-100 (whole numbers); fixed: cents; free_shipping: ignored (0) */
  value: number;
  minSubtotal?: Cents;
  maxDiscount?: Cents; // cap for percent coupons
  startsAt?: ISODate;
  endsAt?: ISODate;
  usageLimit?: number; // total redemptions
  perUserLimit?: number;
  usedCount: number;
  appliesTo?: { categoryIds?: Id[]; brandIds?: Id[]; productIds?: Id[] };
  isActive: boolean;
}

export interface CouponApplication {
  coupon: Coupon;
  discount: Cents;
  freeShipping: boolean;
}

export interface ShippingMethod extends Timestamps {
  id: Id;
  code: string; // "standard" | "express" | "pickup"
  name: LocalizedString;
  description: LocalizedString;
  /** Countries served (ISO alpha-2); ["*"] = anywhere */
  countries: string[];
  price: Cents; // base rate
  perKgPrice: Cents; // added per full kg above 1 kg of order weight
  freeOverSubtotal?: Cents;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ShippingQuote {
  methodId: Id;
  code: string;
  name: LocalizedString;
  description: LocalizedString;
  price: Cents;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface TaxRate extends Timestamps {
  id: Id;
  name: LocalizedString; // "Sales tax (CA)"
  country: string;
  /** Empty = whole country. Matched case-insensitively against address.region */
  region: string;
  /** basis points: 825 = 8.25% */
  rateBps: number;
  appliesToShipping: boolean;
  isActive: boolean;
}

/* ------------------------------------------------------------------ orders & payments */

export type OrderStatus = "pending_payment" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "partially_refunded" | "refunded";

export interface OrderItem {
  id: Id;
  productId: Id;
  variantId: Id;
  sku: string;
  name: LocalizedString;
  variantName: LocalizedString;
  brandName: string;
  image?: string;
  quantity: number;
  unitPrice: Cents;
  discount: Cents; // allocated share of order discount
  tax: Cents;
  lineTotal: Cents; // unitPrice*qty - discount (tax excluded)
  refundedQuantity: number;
}

export interface OrderEvent {
  id: Id;
  at: ISODate;
  type: "created" | "paid" | "payment_failed" | "status_changed" | "note" | "shipped" | "refund" | "cancelled" | "email_sent";
  status?: OrderStatus;
  message?: string;
  actor: Actor;
}

export interface Order extends Timestamps {
  id: Id;
  /** Human number, e.g. "AX-100482" (prefix from settings) */
  number: string;
  userId: Id | null;
  email: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  shippingAddress: AddressInput;
  billingAddress: AddressInput;
  shippingMethod: { id: Id; code: string; name: LocalizedString; price: Cents; estimatedDaysMin: number; estimatedDaysMax: number };
  couponCode?: string;
  subtotal: Cents;
  discount: Cents;
  shipping: Cents;
  tax: Cents;
  total: Cents; // USD base: subtotal - discount + shipping + tax
  /** Display currency chosen at checkout and the fx rate frozen at that moment. */
  currency: Currency;
  fxRate: number; // units of `currency` per 1 USD; 1 for USD
  /** What the customer was actually charged, in `currency` minor units: round(total * fxRate). */
  chargedTotal: number;
  refundedTotal: Cents; // USD base
  locale: "en" | "tr";
  customerNote?: string;
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: ISODate;
  deliveredAt?: ISODate;
  /** Random token letting guests view/track the order without an account. */
  accessToken: string;
  /** Client-supplied idempotency key; replaying it returns the same order. */
  idempotencyKey: string;
  events: OrderEvent[];
  internalNotes: { id: Id; at: ISODate; by: string; body: string }[];
  paymentId?: Id;
  /** Cart this order was placed from (emptied once the order is paid). */
  cartId?: Id;
}

export interface Refund {
  id: Id;
  at: ISODate;
  amount: Cents; // USD base
  amountCharged: number; // in order currency minor units
  reason: string;
  providerRef: string;
  items?: { orderItemId: Id; quantity: number }[];
  /** True when this refund returned the shipping charge (it can only be refunded once). */
  includesShipping?: boolean;
  restock: boolean;
  actor: Actor;
}

export type PaymentIntentStatus = "requires_payment_method" | "requires_action" | "succeeded" | "failed" | "cancelled";

export interface Payment extends Timestamps {
  id: Id;
  orderId: Id;
  provider: "mock" | "stripe";
  providerRef: string;
  amount: number; // in `currency` minor units (what the customer is charged)
  currency: Currency;
  status: PaymentIntentStatus;
  method?: { brand: string; last4: string; expMonth: number; expYear: number };
  failureCode?: string;
  refunds: Refund[];
}

/* ------------------------------------------------------------------ marketing & content */

export interface Wishlist {
  id: Id;
  userId: Id;
  productIds: Id[];
  updatedAt: ISODate;
}

export interface CmsPage extends Timestamps {
  id: Id;
  slug: string; // about, shipping, returns, privacy, terms, faq
  title: LocalizedString;
  body: LocalizedString; // markdown subset (see ARCHITECTURE.md > Markdown)
  isPublished: boolean;
  showInFooter: boolean;
  sortOrder: number;
  seoDescription?: LocalizedString;
}

export type BannerPlacement = "home_hero" | "home_promo" | "announcement" | "category_top";

export interface Banner extends Timestamps {
  id: Id;
  placement: BannerPlacement;
  title: LocalizedString;
  subtitle: LocalizedString;
  ctaLabel: LocalizedString;
  ctaHref: string; // unprefixed internal path ("/shop") or absolute URL
  image?: string;
  /** Visual treatment hint for the store UI */
  tone: "dark" | "orange" | "light";
  startsAt?: ISODate;
  endsAt?: ISODate;
  isActive: boolean;
  sortOrder: number;
}

export interface NewsletterSubscriber {
  id: Id;
  email: string;
  locale: "en" | "tr";
  source: string; // "footer" | "checkout" | "account"
  subscribedAt: ISODate;
  unsubscribedAt?: ISODate;
}

export type ContactStatus = "new" | "read" | "replied" | "archived";

export interface ContactMessage extends Timestamps {
  id: Id;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  orderNumber?: string;
  locale: "en" | "tr";
  status: ContactStatus;
  adminNotes?: string;
}

/* ------------------------------------------------------------------ settings */

export interface StoreSettings extends Timestamps {
  id: "settings";
  store: {
    name: string;
    legalEntity: string;
    email: string;
    phone: string;
    address: { line1: string; city: string; region: string; postalCode: string; country: string };
    taxId?: string;
  };
  currency: {
    base: "USD";
    /** Turkish lira per 1 USD; used for the `tr` locale. Admin-editable. */
    tryPerUsd: number;
  };
  checkout: {
    guestCheckout: boolean;
    orderNumberPrefix: string; // "AX-"
    nextOrderNumber: number;
    maxQuantityPerLine: number;
    freeShippingThreshold: Cents; // 0 = disabled
    defaultCountry: string;
    shippableCountries: string[];
    reservationMinutes: number;
  };
  inventory: { defaultLowStockThreshold: number; allowBackorders: boolean };
  seo: { defaultTitle: LocalizedString; defaultDescription: LocalizedString };
  social: { instagram?: string; youtube?: string; x?: string; facebook?: string };
  maintenanceMode: boolean;
  /** Email notifications */
  emails: { orderConfirmation: boolean; shippingUpdate: boolean; adminNewOrder: boolean; adminAddress: string };
}

/** Safe-for-browser subset */
export interface PublicSettings {
  store: Pick<StoreSettings["store"], "name" | "email" | "phone" | "address">;
  tryPerUsd: number;
  guestCheckout: boolean;
  freeShippingThreshold: Cents;
  maxQuantityPerLine: number;
  shippableCountries: string[];
  defaultCountry: string;
  social: StoreSettings["social"];
  maintenanceMode: boolean;
}

/* ------------------------------------------------------------------ audit & dashboard */

export interface AuditEntry {
  id: Id;
  at: ISODate;
  actor: Actor;
  /** dot.case verb, e.g. "product.update", "order.status_change", "user.role_change" */
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  /** Small before/after diffs only (no secrets, no PII beyond ids/emails). */
  changes?: Record<string, { from: unknown; to: unknown }>;
}

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  revenue: Cents;
  orders: number;
}

export interface DashboardStats {
  range: { from: ISODate; to: ISODate; days: number };
  revenue: { total: Cents; previous: Cents; changePct: number };
  orders: { total: number; previous: number; changePct: number; byStatus: Record<OrderStatus, number> };
  customers: { total: number; new: number };
  averageOrderValue: Cents;
  series: TimeSeriesPoint[];
  topProducts: { productId: Id; name: LocalizedString; sku: string; unitsSold: number; revenue: Cents }[];
  lowStock: { variantId: Id; productId: Id; sku: string; name: LocalizedString; available: number; threshold: number }[];
  pendingReviews: number;
  newMessages: number;
  recentOrders: Order[];
}
