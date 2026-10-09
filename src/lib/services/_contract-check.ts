/**
 * Compile-time contract check (ARCHITECTURE.md > Services). Each service module's namespace must be assignable to
 * its interface in ./contracts.ts, so any drift between implementation and contract fails `tsc --noEmit`.
 * Type-only: this file has no runtime effect and nothing imports it.
 */
import type * as accounts from "./accounts";
import type * as audit from "./audit";
import type * as banners from "./banners";
import type * as cart from "./cart";
import type * as catalog from "./catalog";
import type * as checkout from "./checkout";
import type * as cms from "./cms";
import type * as contact from "./contact";
import type * as coupons from "./coupons";
import type * as dashboard from "./dashboard";
import type * as inventory from "./inventory";
import type * as newsletter from "./newsletter";
import type * as orders from "./orders";
import type * as payments from "./payments";
import type * as reviews from "./reviews";
import type * as search from "./search";
import type * as settings from "./settings";
import type * as shipping from "./shipping";
import type * as tax from "./tax";
import type * as usersAdmin from "./users-admin";
import type * as vehicles from "./vehicles";
import type * as wishlist from "./wishlist";
import type * as email from "@/lib/email";
import type * as session from "@/lib/auth/session";
import type * as cookies from "@/lib/session/cookies";
import type {
  AccountsService,
  AuditService,
  BannersService,
  CartService,
  CatalogService,
  CheckoutService,
  CmsService,
  ContactService,
  CookieHelpers,
  CouponService,
  DashboardService,
  EmailService,
  InventoryService,
  NewsletterService,
  OrdersService,
  PaymentsService,
  ReviewsService,
  SearchService,
  SessionHelpers,
  SettingsService,
  ShippingService,
  TaxService,
  UsersAdminService,
  VehiclesService,
  WishlistService,
} from "./contracts";

type Implements<Impl extends Contract, Contract> = Impl;

export type ServiceContractCheck = [
  Implements<typeof accounts, AccountsService>,
  Implements<typeof audit, AuditService>,
  Implements<typeof banners, BannersService>,
  Implements<typeof cart, CartService>,
  Implements<typeof catalog, CatalogService>,
  Implements<typeof checkout, CheckoutService>,
  Implements<typeof cms, CmsService>,
  Implements<typeof contact, ContactService>,
  Implements<typeof coupons, CouponService>,
  Implements<typeof dashboard, DashboardService>,
  Implements<typeof inventory, InventoryService>,
  Implements<typeof newsletter, NewsletterService>,
  Implements<typeof orders, OrdersService>,
  Implements<typeof payments, PaymentsService>,
  Implements<typeof reviews, ReviewsService>,
  Implements<typeof search, SearchService>,
  Implements<typeof settings, SettingsService>,
  Implements<typeof shipping, ShippingService>,
  Implements<typeof tax, TaxService>,
  Implements<typeof usersAdmin, UsersAdminService>,
  Implements<typeof vehicles, VehiclesService>,
  Implements<typeof wishlist, WishlistService>,
  Implements<typeof email, EmailService>,
  Implements<typeof session, SessionHelpers>,
  Implements<typeof cookies, CookieHelpers>,
];
