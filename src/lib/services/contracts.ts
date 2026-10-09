/**
 * SERVICE CONTRACTS - the exact public API of src/lib/services/*.
 *
 * Binding (ARCHITECTURE.md > Services). The Foundation phase implements each interface below as
 * NAMED FUNCTION EXPORTS of the matching module, e.g. `export async function getProductBySlug(...)`
 * in src/lib/services/catalog.ts. UI/action/API code imports those functions directly:
 *
 *     import { getProductBySlug } from "@/lib/services/catalog";
 *
 * Compile-time check (Foundation adds src/lib/services/_contract-check.ts):
 *     import * as catalog from "./catalog"; const _c: CatalogService = catalog;
 *
 * Conventions
 *  - All functions are async and server-only. Never import services into a "use client" file.
 *  - Reads return raw data (LocalizedString etc.); localise at the edge with `localize(value, locale)`.
 *  - Writes take an `actor` (last param) and write the audit log themselves.
 *  - Services throw `DomainError(code)` for expected failures (codes listed in ARCHITECTURE.md);
 *    they never return `{ ok: false }` - that shape belongs to Server Actions.
 *  - Services do NOT authenticate. Authorisation is enforced by the caller (requireUser/requireRole)
 *    but services DO enforce data ownership when a `userId` is passed (e.g. an order lookup).
 *  - Money is integer USD cents everywhere.
 */
import type {
  Actor,
  Address,
  AddressInput,
  AuditEntry,
  Banner,
  BannerPlacement,
  Brand,
  Cart,
  CartView,
  Category,
  CategoryNode,
  CmsPage,
  ContactMessage,
  ContactStatus,
  Coupon,
  CouponApplication,
  DashboardStats,
  FitmentResult,
  FitmentRow,
  Id,
  InventoryMovement,
  InventoryReason,
  ISODate,
  LocalizedString,
  NewsletterSubscriber,
  Order,
  OrderStatus,
  Paged,
  PageParams,
  Payment,
  PaymentStatus,
  Product,
  ProductDetail,
  ProductImage,
  ProductSpec,
  ProductStatus,
  ProductSummary,
  ProductVariant,
  PublicSettings,
  Review,
  ReviewStatus,
  SessionUser,
  ShippingMethod,
  ShippingQuote,
  StoreSettings,
  TaxRate,
  User,
  UserRole,
  Vehicle,
  VehicleMake,
  VehicleModel,
  VehicleSelection,
  VehicleView,
  VariantOption,
  Cents,
  CouponType,
  StockStatus,
} from "@/lib/types/domain";
import type { Currency, CurrencyContext } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/* ============================================================================ catalog */

export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc" | "rating" | "bestselling" | "name_asc";

export interface ProductQuery extends PageParams {
  /** Free text (names in both locales, brand, SKU, part numbers, OEM numbers, tags). */
  q?: string;
  categoryId?: Id; // includes descendants
  categorySlug?: string; // alternative to categoryId
  brandIds?: Id[];
  brandSlugs?: string[];
  minPrice?: Cents;
  maxPrice?: Cents;
  inStockOnly?: boolean;
  minRating?: number;
  onSale?: boolean;
  featured?: boolean;
  /** Restrict to parts that fit this vehicle (partial selections allowed). Universal parts always match. */
  vehicle?: VehicleSelection;
  sort?: ProductSort;
  /** Locale used for text matching/ranking. */
  locale?: Locale;
}

export interface ProductFacets {
  brands: { id: Id; slug: string; name: string; count: number }[];
  categories: { id: Id; slug: string; name: LocalizedString; count: number }[];
  priceRange: { min: Cents; max: Cents };
  inStockCount: number;
  onSaleCount: number;
  ratings: { rating: 1 | 2 | 3 | 4 | 5; count: number }[]; // count of products with average >= rating
}

export interface ProductListResult extends Paged<ProductSummary> {
  facets: ProductFacets;
}

export interface ProductInput {
  slug?: string; // generated from name.en when omitted
  name: LocalizedString;
  summary: LocalizedString;
  description: LocalizedString;
  brandId: Id;
  categoryId: Id;
  categoryIds?: Id[];
  specs: ProductSpec[];
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  partNumber: string;
  oemNumbers: string[];
  warrantyMonths: number;
  fitment: "universal" | "specific";
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
}

export interface VariantInput {
  sku: string;
  name: LocalizedString;
  options: VariantOption[];
  price: Cents;
  compareAtPrice?: Cents;
  cost?: Cents;
  /** Initial stock when creating; ignored on update (use inventory.adjustStock). */
  initialStock?: number;
  lowStockThreshold: number;
  weightGrams: number;
  barcode?: string;
  imageId?: Id;
  isActive: boolean;
  isDefault: boolean;
  sortOrder?: number;
}

export interface CategoryInput {
  slug?: string;
  parentId: Id | null;
  name: LocalizedString;
  description: LocalizedString;
  image?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
}

export interface BrandInput {
  slug?: string;
  name: string;
  description: LocalizedString;
  logo?: string;
  country?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export interface AdminProductFilter extends PageParams {
  q?: string;
  status?: ProductStatus | "all";
  categoryId?: Id;
  brandId?: Id;
  lowStockOnly?: boolean;
  sort?: "updated_desc" | "name_asc" | "price_asc" | "price_desc" | "stock_asc" | "sold_desc";
}

export interface AdminProductRow {
  product: Product;
  brandName: string;
  categoryName: LocalizedString;
  variantCount: number;
  priceFrom: Cents;
  totalAvailable: number;
  lowStock: boolean;
  image?: ProductImage;
}

export interface CsvImportReport {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface CatalogService {
  /** Storefront listing/search-less browse. Only `active` products with at least one active variant. */
  listProducts(query: ProductQuery): Promise<ProductListResult>;
  getProductBySlug(slug: string, opts?: { vehicle?: VehicleSelection }): Promise<ProductDetail | null>;
  getProductById(id: Id): Promise<Product | null>;
  getProductSummaries(ids: Id[], opts?: { vehicle?: VehicleSelection }): Promise<ProductSummary[]>; // preserves input order, skips missing
  getFeaturedProducts(limit?: number): Promise<ProductSummary[]>;
  getNewArrivals(limit?: number): Promise<ProductSummary[]>;
  getBestSellers(limit?: number): Promise<ProductSummary[]>;
  getDeals(limit?: number): Promise<ProductSummary[]>; // variants with compareAtPrice > price
  getRelatedProducts(productId: Id, limit?: number): Promise<ProductSummary[]>;
  getVariantById(variantId: Id): Promise<ProductVariant | null>;

  getCategoryTree(opts?: { includeInactive?: boolean }): Promise<CategoryNode[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  getCategoryById(id: Id): Promise<Category | null>;
  /** Root -> category (inclusive). */
  getCategoryPath(categoryId: Id): Promise<Category[]>;
  listBrands(opts?: { featuredOnly?: boolean; includeInactive?: boolean }): Promise<(Brand & { productCount: number })[]>;
  getBrandBySlug(slug: string): Promise<Brand | null>;
  getBrandById(id: Id): Promise<Brand | null>;

  /** Slugs + updatedAt for sitemap.ts */
  listSitemapEntries(): Promise<{
    products: { slug: string; updatedAt: ISODate }[];
    categories: { slug: string; updatedAt: ISODate }[];
    brands: { slug: string; updatedAt: ISODate }[];
  }>;

  /* ---- admin ---- */
  adminListProducts(filter: AdminProductFilter): Promise<Paged<AdminProductRow>>;
  adminGetProduct(id: Id): Promise<{ product: Product; variants: ProductVariant[] } | null>;
  createProduct(input: ProductInput, actor: Actor): Promise<Product>;
  updateProduct(id: Id, input: Partial<ProductInput>, actor: Actor): Promise<Product>;
  setProductStatus(id: Id, status: ProductStatus, actor: Actor): Promise<Product>;
  /** Hard delete when never ordered, otherwise archives and returns { archived: true }. */
  deleteProduct(id: Id, actor: Actor): Promise<{ deleted: boolean; archived: boolean }>;
  setProductImages(productId: Id, images: Omit<ProductImage, "id">[], actor: Actor): Promise<ProductImage[]>;
  createVariant(productId: Id, input: VariantInput, actor: Actor): Promise<ProductVariant>;
  updateVariant(variantId: Id, input: Partial<VariantInput>, actor: Actor): Promise<ProductVariant>;
  deleteVariant(variantId: Id, actor: Actor): Promise<{ deleted: boolean; deactivated: boolean }>;

  createCategory(input: CategoryInput, actor: Actor): Promise<Category>;
  updateCategory(id: Id, input: Partial<CategoryInput>, actor: Actor): Promise<Category>;
  deleteCategory(id: Id, actor: Actor): Promise<void>; // throws in_use when it has children/products
  createBrand(input: BrandInput, actor: Actor): Promise<Brand>;
  updateBrand(id: Id, input: Partial<BrandInput>, actor: Actor): Promise<Brand>;
  deleteBrand(id: Id, actor: Actor): Promise<void>; // throws in_use

  exportProductsCsv(): Promise<string>;
  importProductsCsv(csv: string, actor: Actor, opts?: { dryRun?: boolean }): Promise<CsvImportReport>;
}

/* ============================================================================ search */

export interface SearchQuery extends ProductQuery {
  q: string;
}

export interface SearchSuggestions {
  query: string;
  products: Pick<ProductSummary, "id" | "slug" | "name" | "image" | "priceFrom" | "partNumber" | "brand">[];
  categories: { id: Id; slug: string; name: LocalizedString }[];
  brands: { id: Id; slug: string; name: string }[];
  /** Exact SKU/part/OEM number hit, to jump straight to the product. */
  exactMatch?: { slug: string; matchedOn: "sku" | "partNumber" | "oem" };
}

export interface SearchService {
  searchProducts(query: SearchQuery): Promise<ProductListResult & { didYouMean?: string }>;
  /** Fast autocomplete (<= 8 products, 4 categories, 4 brands). */
  suggest(q: string, opts?: { locale?: Locale; vehicle?: VehicleSelection; limit?: number }): Promise<SearchSuggestions>;
  /** Recent/popular terms for the empty search state. */
  getPopularSearches(locale: Locale): Promise<string[]>;
  recordSearch(q: string, resultCount: number): Promise<void>;
}

/* ============================================================================ vehicles & fitment */

export interface VehicleInput {
  makeId: Id;
  modelId: Id;
  year: number;
  engine: string;
  fuel: Vehicle["fuel"];
  bodyType?: string;
}

export interface VehiclesService {
  listMakes(): Promise<VehicleMake[]>;
  listModels(makeId: Id): Promise<VehicleModel[]>;
  /** Years available for a model, newest first. */
  listYears(modelId: Id): Promise<number[]>;
  listEngines(modelId: Id, year: number): Promise<VehicleView[]>;
  getVehicle(id: Id): Promise<VehicleView | null>;
  /** All vehicle ids matching a (possibly partial) selection. */
  resolveSelection(selection: VehicleSelection): Promise<Id[]>;
  /** Human label for the selection, e.g. "2019 BMW 3 Series" (partial selections render what exists). */
  describeSelection(selection: VehicleSelection): Promise<string | null>;
  checkFitment(productId: Id, selection: VehicleSelection): Promise<FitmentResult>;
  /** Fit list for a product page: grouped make -> model -> years. */
  getFitmentSummary(productId: Id): Promise<{ make: string; models: { model: string; years: number[]; engines: string[] }[] }[]>;

  /* ---- admin ---- */
  listFitment(productId: Id): Promise<(FitmentRow & { vehicle: VehicleView })[]>;
  setFitment(productId: Id, rows: { vehicleId: Id; note?: LocalizedString }[], actor: Actor): Promise<void>; // replaces all rows
  addFitment(productId: Id, vehicleIds: Id[], actor: Actor): Promise<void>;
  removeFitment(productId: Id, vehicleIds: Id[], actor: Actor): Promise<void>;
  listAllVehicles(filter?: PageParams & { makeId?: Id; modelId?: Id; q?: string }): Promise<Paged<VehicleView>>;
  createMake(name: string, actor: Actor): Promise<VehicleMake>;
  createModel(makeId: Id, name: string, actor: Actor): Promise<VehicleModel>;
  createVehicle(input: VehicleInput, actor: Actor): Promise<Vehicle>;
  updateVehicle(id: Id, input: Partial<VehicleInput>, actor: Actor): Promise<Vehicle>;
  deleteVehicle(id: Id, actor: Actor): Promise<void>;
}

/* ============================================================================ cart */

export interface CartService {
  /** Find the cart for (cartId | userId) or create an empty one. Returns the persisted cart. */
  getOrCreateCart(opts: { cartId?: Id | null; userId?: Id | null }): Promise<Cart>;
  /** Re-prices and re-validates against live stock/prices, removes dead lines, attaches warnings. null if no such cart. */
  getCartView(cartId: Id): Promise<CartView | null>;
  getCartItemCount(cartId: Id | null | undefined): Promise<number>;
  /** Adds (or increments) a line. Throws out_of_stock / insufficient_stock / variant_unavailable / quantity_invalid. */
  addItem(cartId: Id, variantId: Id, quantity: number): Promise<CartView>;
  /** quantity 0 removes the line. */
  setItemQuantity(cartId: Id, variantId: Id, quantity: number): Promise<CartView>;
  removeItem(cartId: Id, variantId: Id): Promise<CartView>;
  clearCart(cartId: Id): Promise<CartView>;
  applyCoupon(cartId: Id, code: string, userId?: Id | null): Promise<CartView>; // throws coupon_* codes
  removeCoupon(cartId: Id): Promise<CartView>;
  /** On login: move guest lines into the user's cart (sum quantities, cap at stock). Returns the user's cart. */
  mergeGuestCart(guestCartId: Id, userId: Id): Promise<Cart>;
}

/* ============================================================================ shipping, tax, coupons */

export interface ShippingMethodInput {
  code: string;
  name: LocalizedString;
  description: LocalizedString;
  countries: string[];
  price: Cents;
  perKgPrice: Cents;
  freeOverSubtotal?: Cents;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ShippingService {
  /** Active methods that serve `country`, priced for this order. Empty array = cannot ship there. */
  getQuotes(input: { country: string; subtotal: Cents; totalWeightGrams: number; freeShippingCoupon?: boolean }): Promise<ShippingQuote[]>;
  getQuote(methodId: Id, input: { country: string; subtotal: Cents; totalWeightGrams: number; freeShippingCoupon?: boolean }): Promise<ShippingQuote>; // throws shipping_unavailable
  /* admin */
  listShippingMethods(): Promise<ShippingMethod[]>;
  createShippingMethod(input: ShippingMethodInput, actor: Actor): Promise<ShippingMethod>;
  updateShippingMethod(id: Id, input: Partial<ShippingMethodInput>, actor: Actor): Promise<ShippingMethod>;
  deleteShippingMethod(id: Id, actor: Actor): Promise<void>;
}

export interface TaxRateInput {
  name: LocalizedString;
  country: string;
  region: string;
  rateBps: number;
  appliesToShipping: boolean;
  isActive: boolean;
}

export interface TaxService {
  /** Tax is exclusive (added on top). Most specific matching rate wins (region over country). */
  calculateTax(input: { country: string; region: string; taxableSubtotal: Cents; shipping: Cents }): Promise<{ tax: Cents; rate?: TaxRate }>;
  /** Per-line split of an order-level tax amount, so refunds can be proportional. */
  allocateTax(lineAmounts: Cents[], totalTax: Cents): number[];
  /* admin */
  listTaxRates(): Promise<TaxRate[]>;
  createTaxRate(input: TaxRateInput, actor: Actor): Promise<TaxRate>;
  updateTaxRate(id: Id, input: Partial<TaxRateInput>, actor: Actor): Promise<TaxRate>;
  deleteTaxRate(id: Id, actor: Actor): Promise<void>;
}

export interface CouponInput {
  code: string;
  description: LocalizedString;
  type: CouponType;
  value: number;
  minSubtotal?: Cents;
  maxDiscount?: Cents;
  startsAt?: ISODate;
  endsAt?: ISODate;
  usageLimit?: number;
  perUserLimit?: number;
  appliesTo?: Coupon["appliesTo"];
  isActive: boolean;
}

export interface CouponService {
  /** Pure validation + discount calculation for a cart snapshot. Throws coupon_* DomainErrors. */
  validateCoupon(input: {
    code: string;
    lines: { productId: Id; brandId: Id; categoryIds: Id[]; lineTotal: Cents }[];
    subtotal: Cents;
    userId?: Id | null;
    email?: string;
  }): Promise<CouponApplication>;
  /** Increments usedCount + records redemption for (userId|email). Called by checkout after payment. */
  redeemCoupon(code: string, ctx: { orderId: Id; userId?: Id | null; email: string }): Promise<void>;
  /* admin */
  listCoupons(filter?: PageParams & { q?: string; status?: "active" | "expired" | "scheduled" | "disabled" | "all" }): Promise<Paged<Coupon>>;
  getCoupon(id: Id): Promise<Coupon | null>;
  createCoupon(input: CouponInput, actor: Actor): Promise<Coupon>;
  updateCoupon(id: Id, input: Partial<CouponInput>, actor: Actor): Promise<Coupon>;
  deleteCoupon(id: Id, actor: Actor): Promise<void>;
}

/* ============================================================================ checkout & orders */

export interface CheckoutQuoteInput {
  cartId: Id;
  /** Country + region are enough to quote shipping and tax before the full address is typed. */
  destination: { country: string; region?: string; postalCode?: string };
  shippingMethodId?: Id;
  locale: Locale;
  userId?: Id | null;
}

export interface CheckoutQuote {
  cart: CartView;
  shippingQuotes: ShippingQuote[];
  selectedShipping?: ShippingQuote;
  taxRate?: { name: LocalizedString; rateBps: number };
  /** USD base totals (authoritative). */
  totals: { subtotal: Cents; discount: Cents; shipping: Cents; tax: Cents; total: Cents };
  /** What will be charged, in display currency minor units. */
  charge: { currency: Currency; fxRate: number; amount: number };
}

export type PaymentInput =
  | { type: "card"; card: { number: string; expMonth: number; expYear: number; cvc: string; holder: string } }
  /** Future real providers: client-side tokenised method (Stripe PaymentMethod id etc). */
  | { type: "token"; token: string };

export interface PlaceOrderInput {
  cartId: Id;
  userId?: Id | null;
  email: string;
  shippingAddress: AddressInput;
  billingAddress?: AddressInput; // omitted = same as shipping
  shippingMethodId: Id;
  locale: Locale;
  customerNote?: string;
  /** Required. Replays with the same key return the original result instead of double charging. */
  idempotencyKey: string;
  payment: PaymentInput;
  newsletterOptIn?: boolean;
  /** When set and userId is set, save the shipping address to the address book. */
  saveAddress?: boolean;
  /** Optional: the USD-cents total the customer saw. When it differs from the authoritative total, placeOrder throws `price_changed`. */
  expectedTotal?: Cents;
}

export type PlaceOrderResult =
  | { status: "succeeded"; order: Order }
  | { status: "requires_action"; order: Order; actionToken: string }
  | { status: "failed"; order?: Order; error: string };

export interface CheckoutService {
  /** Authoritative server-side pricing for the checkout screen. Never trust client totals. */
  getCheckoutQuote(input: CheckoutQuoteInput): Promise<CheckoutQuote>;
  /**
   * Atomically (inside the DB mutex): re-validate cart, reserve stock, recompute totals, create the
   * order as pending_payment, charge via the PaymentProvider, then on success commit stock, redeem the
   * coupon, mark paid -> processing, clear the cart, send the confirmation email. On decline: release stock,
   * keep the order as pending_payment/failed so the customer can retry with the same cart.
   */
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  /** Second leg of a 3-D-Secure-style challenge returned by placeOrder. */
  completePaymentAction(input: { orderNumber: string; actionToken: string; approved: boolean; access: OrderAccess }): Promise<PlaceOrderResult>;
}

/** Proves the caller may see an order. Exactly one form is used. */
export type OrderAccess = { userId: Id } | { accessToken: string } | { staff: true };

export interface OrderFilter extends PageParams {
  q?: string; // number, email, customer name
  status?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  from?: ISODate;
  to?: ISODate;
  userId?: Id;
  sort?: "created_desc" | "created_asc" | "total_desc" | "total_asc";
}

export interface RefundInput {
  /** USD cents to refund. Omit when `items` is given: computed from the lines. */
  amount?: Cents;
  items?: { orderItemId: Id; quantity: number }[];
  includeShipping?: boolean;
  reason: string;
  restock: boolean;
}

export interface OrdersService {
  getOrderByNumber(number: string, access: OrderAccess): Promise<Order | null>; // null when not found OR not permitted
  listOrdersForUser(userId: Id, params?: PageParams): Promise<Paged<Order>>;
  /** Guest tracking form: number + email must both match. */
  trackOrder(input: { number: string; email: string }): Promise<Order | null>;
  /** Customer self-service: allowed only while pending_payment/processing and not shipped. Restocks. */
  cancelOwnOrder(input: { number: string; userId: Id; reason?: string }): Promise<Order>;
  hasUserPurchased(userId: Id, productId: Id): Promise<boolean>;

  /* ---- admin ---- */
  adminListOrders(filter: OrderFilter): Promise<Paged<Order>>;
  adminGetOrder(id: Id): Promise<{ order: Order; payment?: Payment; customer?: User | null } | null>;
  /** Enforces the status graph (ARCHITECTURE.md > Orders). Throws invalid_status_transition. */
  updateOrderStatus(id: Id, status: OrderStatus, actor: Actor, note?: string): Promise<Order>;
  markShipped(id: Id, input: { carrier: string; trackingNumber: string; notifyCustomer?: boolean }, actor: Actor): Promise<Order>;
  markDelivered(id: Id, actor: Actor): Promise<Order>;
  cancelOrder(id: Id, input: { reason: string; restock: boolean; refund: boolean }, actor: Actor): Promise<Order>;
  refundOrder(id: Id, input: RefundInput, actor: Actor): Promise<Order>;
  addOrderNote(id: Id, body: string, actor: Actor): Promise<Order>;
  exportOrdersCsv(filter: Omit<OrderFilter, "page" | "pageSize">): Promise<string>;
}

/* ============================================================================ payments (provider abstraction) */

/** Implemented by MockPaymentProvider (default) and any future real provider. Lives in src/lib/payments. */
export interface PaymentProvider {
  readonly id: "mock" | "stripe";
  /** Amount is in `currency` minor units. Must be idempotent on `idempotencyKey`. */
  charge(input: {
    amount: number;
    currency: Currency;
    payment: PaymentInput;
    idempotencyKey: string;
    metadata: { orderNumber: string; email: string };
  }): Promise<
    | { status: "succeeded"; providerRef: string; method: NonNullable<Payment["method"]> }
    | { status: "requires_action"; providerRef: string; actionToken: string; method: NonNullable<Payment["method"]> }
    | { status: "failed"; code: "card_declined" | "insufficient_funds" | "expired_card" | "processing_error"; providerRef?: string }
  >;
  /** Resolves a requires_action intent. */
  confirmAction(input: { providerRef: string; actionToken: string; approved: boolean }): Promise<
    { status: "succeeded"; providerRef: string } | { status: "failed"; code: "authentication_failed" }
  >;
  refund(input: { providerRef: string; amount: number; currency: Currency; reason: string; idempotencyKey: string }): Promise<
    { status: "succeeded"; refundRef: string } | { status: "failed"; code: string }
  >;
  /**
   * Verifies the signature of an incoming webhook (raw body, exactly as received) and normalises the event.
   * `signature` is the value of the provider's signature header (mock: `x-apexline-signature`, Stripe: `stripe-signature`).
   */
  verifyWebhook(rawBody: string, signature: string | null): { valid: true; event: PaymentWebhookEvent } | { valid: false };
}

/** Provider-neutral webhook events handled by src/app/api/webhooks/payments. */
export type PaymentWebhookEvent =
  | { type: "payment.succeeded"; providerRef: string }
  | { type: "payment.failed"; providerRef: string; code?: string }
  | { type: "refund.succeeded"; providerRef: string; refundRef?: string };

export interface PaymentsService {
  getProvider(): PaymentProvider;
  getPaymentForOrder(orderId: Id): Promise<Payment | null>;
}

/* ============================================================================ inventory */

export interface InventoryFilter extends PageParams {
  variantId?: Id;
  productId?: Id;
  reason?: InventoryReason;
  from?: ISODate;
  to?: ISODate;
}

export interface InventoryService {
  /** Live availability for many variants at once. */
  getAvailability(variantIds: Id[]): Promise<Record<Id, { available: number; status: StockStatus }>>;
  getStockStatus(available: number, lowStockThreshold: number): StockStatus;
  /** Manual change (restock, damage, count correction). delta is signed. Throws if it would drop below reserved. */
  adjustStock(input: { variantId: Id; delta: number; reason: Extract<InventoryReason, "adjustment" | "purchase" | "damage" | "correction" | "return">; note?: string; reference?: string }, actor: Actor): Promise<InventoryMovement>;
  /** Set absolute on-hand (records the delta as a "correction"). */
  setStock(variantId: Id, onHand: number, note: string | undefined, actor: Actor): Promise<InventoryMovement>;
  listMovements(filter: InventoryFilter): Promise<Paged<InventoryMovement & { sku: string; productName: LocalizedString }>>;
  listLowStock(opts?: { limit?: number; includeOutOfStock?: boolean }): Promise<{ variantId: Id; productId: Id; sku: string; productName: LocalizedString; variantName: LocalizedString; available: number; onHand: number; threshold: number }[]>;
  /* used by checkout/orders inside the DB mutex; exported so they are testable */
  reserveStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void>; // throws insufficient_stock
  releaseStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void>;
  commitStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void>; // reserved -> sold (on-hand decreases)
  restockItems(items: { variantId: Id; quantity: number }[], reference: string, actor: Actor): Promise<void>;
  /** Releases stock held by pending_payment orders older than settings.checkout.reservationMinutes and marks them cancelled. Called lazily from placeOrder / adminListOrders. Returns orders released. */
  releaseExpiredReservations(): Promise<number>;
}

/* ============================================================================ reviews, wishlist */

export interface ReviewInput {
  productId: Id;
  userId?: Id | null;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  locale: Locale;
}

export interface ReviewsService {
  listApprovedReviews(productId: Id, params?: PageParams & { sort?: "newest" | "highest" | "lowest" | "helpful"; rating?: number }): Promise<Paged<Review>>;
  /** Creates a `pending` review (verifiedPurchase computed). One review per user per product. */
  createReview(input: ReviewInput): Promise<Review>;
  canReview(userId: Id, productId: Id): Promise<{ allowed: boolean; reason?: "already_reviewed"; verifiedPurchase: boolean }>;
  markHelpful(reviewId: Id, voterKey: string): Promise<{ helpfulCount: number }>;
  /* admin */
  adminListReviews(filter: PageParams & { status?: ReviewStatus | "all"; productId?: Id; q?: string; rating?: number }): Promise<Paged<Review & { productName: LocalizedString; productSlug: string }>>;
  setReviewStatus(id: Id, status: ReviewStatus, actor: Actor): Promise<Review>; // recomputes product rating aggregates
  replyToReview(id: Id, body: string, actor: Actor): Promise<Review>;
  deleteReview(id: Id, actor: Actor): Promise<void>;
}

export interface WishlistService {
  getWishlistProducts(userId: Id): Promise<ProductSummary[]>;
  getWishlistIds(userId: Id): Promise<Id[]>;
  toggleWishlist(userId: Id, productId: Id): Promise<{ inWishlist: boolean; count: number }>;
  removeFromWishlist(userId: Id, productId: Id): Promise<void>;
  clearWishlist(userId: Id): Promise<void>;
}

/* ============================================================================ accounts, addresses, users admin */

export interface ProfileInput {
  name: string;
  phone?: string | null;
  locale: Locale;
  marketingOptIn: boolean;
}

export interface AccountsService {
  getUserById(id: Id): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateProfile(userId: Id, input: ProfileInput): Promise<User>;
  getAccountSummary(userId: Id): Promise<{ orderCount: number; wishlistCount: number; addressCount: number; lastOrder?: Order; totalSpent: Cents }>;
  listAddresses(userId: Id): Promise<Address[]>;
  createAddress(userId: Id, input: AddressInput & { isDefaultShipping?: boolean; isDefaultBilling?: boolean }): Promise<Address>;
  updateAddress(userId: Id, addressId: Id, input: Partial<AddressInput> & { isDefaultShipping?: boolean; isDefaultBilling?: boolean }): Promise<Address>; // ownership enforced
  deleteAddress(userId: Id, addressId: Id): Promise<void>;
  /** Deletes/anonymises the account (orders keep an anonymised snapshot). */
  deleteAccount(userId: Id): Promise<void>;
}

export interface UserFilter extends PageParams {
  q?: string;
  role?: UserRole | "all" | "staff_and_admin";
  status?: "active" | "disabled" | "all";
  sort?: "created_desc" | "name_asc" | "spent_desc" | "orders_desc";
}

export interface UserRow {
  user: User;
  orderCount: number;
  totalSpent: Cents;
  lastOrderAt?: ISODate;
}

export interface UsersAdminService {
  listUsers(filter: UserFilter): Promise<Paged<UserRow>>;
  getUserDetail(id: Id): Promise<{ user: User; addresses: Address[]; orders: Order[]; totalSpent: Cents; reviewsCount: number } | null>;
  /** Creates a staff/admin account and sends a set-password email via the outbox. */
  createStaffUser(input: { name: string; email: string; role: Exclude<UserRole, "customer"> }, actor: Actor): Promise<User>;
  setUserRole(id: Id, role: UserRole, actor: Actor): Promise<User>; // throws last_admin / cannot_modify_self
  setUserDisabled(id: Id, disabled: boolean, actor: Actor): Promise<User>; // revokes sessions when disabling
  sendPasswordReset(id: Id, actor: Actor): Promise<void>;
  deleteUser(id: Id, actor: Actor): Promise<void>;
}

/* ============================================================================ content */

export interface CmsPageInput {
  slug: string;
  title: LocalizedString;
  body: LocalizedString;
  isPublished: boolean;
  showInFooter: boolean;
  sortOrder: number;
  seoDescription?: LocalizedString;
}

export interface CmsService {
  getPageBySlug(slug: string, opts?: { includeUnpublished?: boolean }): Promise<CmsPage | null>;
  listFooterPages(): Promise<Pick<CmsPage, "slug" | "title" | "sortOrder">[]>;
  listPublishedSlugs(): Promise<{ slug: string; updatedAt: ISODate }[]>;
  /* admin */
  listPages(): Promise<CmsPage[]>;
  getPageById(id: Id): Promise<CmsPage | null>;
  createPage(input: CmsPageInput, actor: Actor): Promise<CmsPage>;
  updatePage(id: Id, input: Partial<CmsPageInput>, actor: Actor): Promise<CmsPage>;
  deletePage(id: Id, actor: Actor): Promise<void>;
}

export interface BannerInput {
  placement: BannerPlacement;
  title: LocalizedString;
  subtitle: LocalizedString;
  ctaLabel: LocalizedString;
  ctaHref: string;
  image?: string;
  tone: Banner["tone"];
  startsAt?: ISODate;
  endsAt?: ISODate;
  isActive: boolean;
  sortOrder: number;
}

export interface BannersService {
  /** Active banners whose schedule covers `now`, ordered by sortOrder. */
  getActiveBanners(placement: BannerPlacement, now?: Date): Promise<Banner[]>;
  /* admin */
  listBanners(): Promise<Banner[]>;
  getBanner(id: Id): Promise<Banner | null>;
  createBanner(input: BannerInput, actor: Actor): Promise<Banner>;
  updateBanner(id: Id, input: Partial<BannerInput>, actor: Actor): Promise<Banner>;
  deleteBanner(id: Id, actor: Actor): Promise<void>;
}

export interface SettingsService {
  getSettings(): Promise<StoreSettings>;
  getPublicSettings(): Promise<PublicSettings>;
  /** Display currency + rate for a locale (en -> USD/1, tr -> TRY/tryPerUsd). Use with formatMoney(). */
  getCurrencyContext(locale: Locale): Promise<CurrencyContext>;
  updateSettings(patch: DeepPartial<Omit<StoreSettings, "id" | "createdAt" | "updatedAt" | "checkout"> & { checkout: Omit<StoreSettings["checkout"], "nextOrderNumber"> }>, actor: Actor): Promise<StoreSettings>;
  /** Atomically reads+increments the order counter and returns e.g. "AX-100483". Used by checkout only. */
  allocateOrderNumber(): Promise<string>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface NewsletterService {
  subscribe(input: { email: string; locale: Locale; source: string }): Promise<{ alreadySubscribed: boolean }>;
  unsubscribe(email: string): Promise<void>;
  /* admin */
  listSubscribers(params?: PageParams & { q?: string }): Promise<Paged<NewsletterSubscriber>>;
  exportSubscribersCsv(): Promise<string>;
  deleteSubscriber(id: Id, actor: Actor): Promise<void>;
}

export interface ContactService {
  /** Persists, rate-limits by caller key, writes an acknowledgement + staff email to the outbox. */
  submitMessage(input: { name: string; email: string; phone?: string; subject: string; message: string; orderNumber?: string; locale: Locale }): Promise<ContactMessage>;
  /* admin */
  listMessages(params?: PageParams & { status?: ContactStatus | "all"; q?: string }): Promise<Paged<ContactMessage>>;
  getMessage(id: Id): Promise<ContactMessage | null>;
  updateMessage(id: Id, patch: { status?: ContactStatus; adminNotes?: string }, actor: Actor): Promise<ContactMessage>;
  deleteMessage(id: Id, actor: Actor): Promise<void>;
}

/* ============================================================================ analytics, audit, email */

export interface DashboardService {
  getDashboardStats(opts?: { days?: 7 | 30 | 90 | 365 }): Promise<DashboardStats>;
  getSalesReport(opts: { from: ISODate; to: ISODate; groupBy: "day" | "week" | "month" }): Promise<{ period: string; revenue: Cents; orders: number; units: number; averageOrderValue: Cents }[]>;
}

export interface AuditFilter extends PageParams {
  q?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: Id;
  from?: ISODate;
  to?: ISODate;
}

export interface AuditService {
  logAudit(entry: Omit<AuditEntry, "id" | "at">): Promise<AuditEntry>;
  listAudit(filter: AuditFilter): Promise<Paged<AuditEntry>>;
}

export interface OutboxEmail {
  id: Id;
  at: ISODate;
  to: string;
  subject: string;
  template: string;
  locale: Locale;
  html: string;
  text: string;
}

/** src/lib/email - mailer interface with a file-outbox implementation (data/outbox). */
export interface EmailService {
  sendOrderConfirmation(order: Order): Promise<void>;
  sendShippingUpdate(order: Order): Promise<void>;
  sendRefundNotice(order: Order, amount: Cents): Promise<void>;
  sendPasswordReset(input: { email: string; name: string; url: string; locale: Locale }): Promise<void>;
  sendVerifyEmail(input: { email: string; name: string; url: string; locale: Locale }): Promise<void>;
  sendStaffInvite(input: { email: string; name: string; url: string; locale: Locale }): Promise<void>;
  sendContactAck(message: ContactMessage): Promise<void>;
  /** Admin/dev viewer for the outbox. */
  listOutbox(params?: PageParams & { to?: string }): Promise<Paged<OutboxEmail>>;
  getOutboxEmail(id: Id): Promise<OutboxEmail | null>;
}

/* ============================================================================ session helpers (src/lib/auth/session.ts) */

/** Server-only helpers wrapping Better Auth. The ONLY way UI/actions/API read the session. */
export interface SessionHelpers {
  /** null when signed out. Cached per request. */
  getSessionUser(): Promise<SessionUser | null>;
  /** Redirects (locale-aware) to /{locale}/login?next=... when signed out. */
  requireUser(locale: Locale, nextPath?: string): Promise<SessionUser>;
  /** For admin pages/actions: redirects to /admin/login when signed out, throws forbidden for customers/insufficient permission. */
  requireStaff(permission?: import("@/lib/types/domain").Permission): Promise<SessionUser>;
  /** For Server Actions/route handlers: throws DomainError("unauthorized"/"forbidden") instead of redirecting. */
  assertStaff(permission?: import("@/lib/types/domain").Permission): Promise<SessionUser>;
  assertUser(): Promise<SessionUser>;
  can(role: UserRole, permission: import("@/lib/types/domain").Permission): boolean;
  /** Actor for audit logs from the current session. */
  toActor(user: SessionUser): Actor;
}

/** Cookie helpers (src/lib/session/*.ts), all httpOnly + SameSite=Lax + Secure in production. */
export interface CookieHelpers {
  getCartId(): Promise<Id | null>; // cookie `cart_id`, 60 days
  setCartId(id: Id): Promise<void>;
  clearCartId(): Promise<void>;
  getVehicleSelection(): Promise<VehicleSelection>; // cookie `vehicle` (JSON), 1 year; {} when absent/invalid
  setVehicleSelection(selection: VehicleSelection): Promise<void>;
  clearVehicleSelection(): Promise<void>;
  getAdminLocale(): Promise<Locale>; // cookie `admin_locale`
  setAdminLocale(locale: Locale): Promise<void>;
}
