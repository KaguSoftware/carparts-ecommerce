# APEXLINE Auto Parts - Architecture Contract

This document is **binding** for every contributor (human or agent). If you need something this
file does not allow, change the contract here first (Foundation owner), never work around it.

- Product: full e-commerce site for car parts. Brand "APEXLINE Auto Parts" (`src/config/brand.ts`).
- Stack: Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript strict, Tailwind v4,
  next-intl 4 (`en`, `tr`), Better Auth + custom JSON-file adapter, zod 4, react-hook-form,
  lucide-react, recharts, vitest, Playwright.
- Persistence: JSON files behind repository interfaces (`src/lib/db`). A real DB replaces the
  implementation later without touching services, actions, API or UI.
- Verify your area with: `npm run messages:check`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

Source of truth for types and signatures are the TypeScript files listed in the
[Appendix](#appendix-contract-source-files). The appendix is a verbatim copy refreshed by
`npm run docs:arch`. If prose and code disagree, the code files win.

---

## 1. Layering (data flows one way)

```
UI (server components, client components)
  -> Server Actions (src/actions/**)  /  Route Handlers (src/app/api/**)
      -> Services (src/lib/services/**)           business rules, validation of invariants, audit
          -> Repositories (src/lib/db/**)         persistence only
```

Hard rules:

1. **UI never imports from `src/lib/db`.** Server components call **services** directly for reads.
2. **Client components never import services, `src/lib/db`, `src/lib/auth/auth.ts`, or `env`.**
   They receive data as props and mutate through Server Actions.
3. **Mutations go through Server Actions** (or an API route when the caller is not our UI).
   Services never call `cookies()`, `headers()`, `redirect()` or `revalidatePath()`; actions do.
4. **Services do not authenticate.** Actions/route handlers authorise (`assertStaff`, `assertUser`)
   *before* calling a service, and pass the `Actor` into every admin write for the audit log.
   Services enforce data *ownership* when given a `userId` (cannot read another user's order).
5. **Never trust the client for money.** Prices, discounts, shipping, tax and totals are recomputed
   server-side from variant ids + quantities. Client-sent totals are ignored.
6. Every module in `src/lib/db`, `src/lib/services`, `src/lib/auth` (except `client.ts`), `src/lib/payments`,
   `src/lib/email`, `src/lib/session` and `src/lib/env.ts` (except `src/lib/db/seed/**`, which scripts import) begins with `import "server-only";` so an accidental
   client import fails the build.

---

## 2. Directory ownership

Only the owner edits an area. Need a change elsewhere? Use the contract (call a service, import an
exported component) or ask the owner. Cross-area imports are allowed only where listed.

| Area | Owns (paths) |
|---|---|
| **Foundation** | `ARCHITECTURE.md`, root configs, `scripts/**`, `src/config/**`, `src/i18n/**`, `src/proxy.ts`, `src/lib/**` (db, services, auth, payments, email, security, validation, hooks, session, types), `src/components/ui/**`, `src/components/brand/**`, `src/components/shared/**`, `src/app/globals.css`, `src/app/[locale]/{layout,error,not-found,opengraph-image}.tsx`, `src/app/[locale]/styleguide/**`, `src/app/admin/layout.tsx`, `src/app/api/auth/**`, `src/app/api/health/**`, `src/app/icon.svg`, `src/lib/db/seed/**`, `public/{logo*,og-logo,products/**}`, `messages/_src/{common,ui,email,seo}.*.json`, `tests/unit/**` |
| **Store** | `src/app/[locale]/(store)/**`, `src/app/{sitemap,robots}.ts`, `src/components/store/**`, `src/actions/store/**`, `messages/_src/store*.json`, `tests/e2e/store*.spec.ts` |
| **Account + Checkout** | `src/app/[locale]/(account)/**`, `src/app/[locale]/(checkout)/**`, `src/components/account/**`, `src/components/checkout/**`, `src/actions/account/**`, `src/actions/checkout/**`, `messages/_src/{account,auth,checkout}*.json`, `tests/e2e/{account,checkout}*.spec.ts` |
| **Admin** | `src/app/admin/(panel)/**`, `src/app/admin/login/**`, `src/components/admin/**`, `src/actions/admin/**`, `messages/_src/admin*.json`, `tests/e2e/admin*.spec.ts` |
| **API** | `src/app/api/**` except `auth/` and `health/`, `tests/api/**` |
| **Engine3D** | `src/components/engine3d/**` (three.js, `@react-three/fiber`, `@react-three/drei` live ONLY here), `messages/_src/engine3d*.json`, `tests/unit/engine3d*.test.ts` |

Cross-area imports that ARE allowed:

- Any area -> `src/components/{ui,brand,shared}`, `src/lib/**`, `src/config/**`, `src/i18n/**`.
- Account/Checkout -> `@/components/store/layout` (`SiteHeader`, `SiteFooter`) and the cart/wishlist/vehicle
  actions exported by Store (list in section 7.3). Checkout may import `@/components/store/product/ProductThumb`.
- Admin -> nothing from `store`/`account`/`checkout` components (admin has its own shell).
- Store never imports from `account`, `checkout` or `admin`.
- Store -> `@/components/engine3d` (`EngineTeardown`, a client component; the home page embeds it). Engine3D imports only
  `@/components/ui`, `@/i18n/navigation`, `@/lib/utils` and its own files. three.js, `@react-three/fiber` and
  `@react-three/drei` may be imported nowhere else, and only inside the lazily loaded `EngineStage` chunk
  (`next/dynamic`, `ssr: false`) so they never reach the initial bundle. See `src/components/engine3d/README.md`.

File conventions: components `PascalCase.tsx`; everything else `kebab-case.ts`; one default export
per `page|layout|loading|error|not-found|route`; named exports elsewhere. Folders `src/components/<area>/<feature>/`.
Server Actions files start with `"use server"` and export only async functions (types go in `*.types.ts`).

## 3. Route map

Storefront / account / checkout live under `src/app/[locale]/` (`localePrefix: "always"`: `/en/...`, `/tr/...`).
Admin lives under `src/app/admin/` with **no locale segment**; its language comes from the
`admin_locale` cookie and it loads the same message bundles.

```
src/app/
  [locale]/                      layout.tsx (Foundation root: <html>, fonts, theme, providers)
    (store)/                     layout.tsx (Store: skip link, SiteHeader, SiteFooter, mini-cart)
      page.tsx                   /                      home (hero banners, categories, featured, deals, brands, vehicle finder)
      shop/page.tsx              /shop                  all products, facets + sort + pagination via searchParams
      category/[slug]/page.tsx   /category/{slug}       category (+ subcategories), same listing UI
      brand/[slug]/page.tsx      /brand/{slug}
      brands/page.tsx            /brands
      deals/page.tsx             /deals
      product/[slug]/page.tsx    /product/{slug}        gallery, variants, fitment checker, specs, reviews, related, JSON-LD
      search/page.tsx            /search?q=
      cart/page.tsx              /cart
      garage/page.tsx            /garage                saved vehicle management (cookie)
      contact/page.tsx           /contact
      track-order/page.tsx       /track-order           guest tracking (number + email)
      pages/[slug]/page.tsx      /pages/{slug}          CMS pages (about, shipping, returns, privacy, terms, faq)
    (account)/                   layout.tsx (Account: SiteHeader/Footer + account sub-nav for /account/**)
      login/page.tsx register/page.tsx forgot-password/page.tsx reset-password/page.tsx verify-email/page.tsx
      account/page.tsx                 /account            overview
      account/orders/page.tsx          /account/orders
      account/orders/[number]/page.tsx /account/orders/{AX-100482}
      account/addresses/page.tsx account/wishlist/page.tsx account/profile/page.tsx account/security/page.tsx
    (checkout)/                  layout.tsx (Checkout: minimal header with logo + secure badge, no footer nav)
      checkout/page.tsx                          /checkout   single-page: contact, address, shipping, coupon, payment
      checkout/confirmation/[number]/page.tsx    /checkout/confirmation/{number}?t={accessToken}
    styleguide/                  (Foundation, dev-only)
  admin/
    layout.tsx                   (Foundation root shell for admin: <html>, providers)
    login/page.tsx               /admin/login           (public)
    (panel)/layout.tsx           (Admin: requireStaff(), sidebar, topbar, admin locale + theme switch)
    (panel)/page.tsx             /admin                 dashboard
    (panel)/products[/new|/[id]] (variants, images, fitment tab, SEO tab, CSV import/export)
    (panel)/{categories,brands,vehicles,inventory,orders,orders/[id],orders/[id]/invoice,customers,customers/[id],
             reviews,coupons,shipping,tax,banners,pages,messages,newsletter,staff,audit,settings,emails}
  api/
    auth/[...all]/route.ts       Better Auth handler (Foundation)
    health/route.ts              GET -> { status, time, version } (Foundation)
    search/suggest/route.ts      GET ?q=&locale=
    vehicles/{makes,models,years,engines}/route.ts   GET cascade for the selector
    vehicle/selection/route.ts   GET/PUT/DELETE the `vehicle` cookie
    products/route.ts            GET (list/filter, same params as ProductQuery)   products/[slug]/route.ts GET
    cart/route.ts                GET/POST/PATCH/DELETE (cookie cart; JSON parity of cart actions)
    cart/coupon/route.ts         POST {code} / DELETE (rate limited)
    newsletter/route.ts contact/route.ts reviews/[id]/helpful/route.ts
  uploads/[...path]/route.ts     GET: serves files from UPLOAD_DIR (Next only serves /public files that existed at build time)
    uploads/route.ts             POST multipart (staff only), images <= 5 MB -> /public/uploads
    admin/export/{orders,products,subscribers}/route.ts   GET CSV (staff only, audited)
    admin/import/products/route.ts                         POST CSV (staff only, audited)
    webhooks/payments/route.ts   POST (mock provider event receiver; signature check)
  sitemap.ts, robots.ts, icon.svg
```

Rules:

- Links in storefront/account/checkout code use `Link`/`redirect`/`useRouter`/`usePathname` from
  `@/i18n/navigation` with **unprefixed** paths (`href="/product/abc"`). In admin use `next/link`
  with `/admin/...` paths. Never mix.
- Dynamic params are async in Next 16: `const { slug } = await params;` and
  `searchParams: Promise<Record<string, string | string[] | undefined>>`. Call
  `setRequestLocale(locale)` at the top of every `[locale]` page/layout.
- Every route that can 404 calls `notFound()`. Every data page has a `loading.tsx` using `Skeleton`.
- `proxy.ts` only does a *cheap cookie presence* gate for `/admin/**` and `/{locale}/account/**`
  (redirect to login with `?next=`). The real check is `requireStaff()` / `requireUser()` in the layout
  **and** `assertStaff()` / `assertUser()` in every action/route.
- `/admin/*` responses are `noindex` + `no-store` (set in proxy).

## 4. Naming and structure

- Money fields: no suffix, integer USD cents (`price`, `total`). Display strings are derived.
- Ids: opaque strings from `createId()` (`src/lib/db/id.ts`). Prefix by type for debuggability (`prd_...`).
- Slugs: lowercase ascii (`slugify()`), unique per collection.
- Dates: ISO-8601 UTC strings. Format only at the edge with next-intl `format.dateTime`.
- Booleans `is*`/`has*`. Collections plural camelCase (`inventoryMovements`).
- Action names `verbNounAction` (`addToCartAction`), schemas `verbNounSchema` in `*.schema.ts` next to the action.
- CSS: Tailwind utilities + semantic tokens only (section 12). No CSS modules, no inline hex colours.

## 5. Services

- Each module is `src/lib/services/<name>.ts` exporting **named async functions** exactly as declared
  in `src/lib/services/contracts.ts` (module -> interface: `catalog` -> `CatalogService`, `search`,
  `vehicles` -> `VehiclesService`, `cart`, `shipping`, `tax`, `coupons` -> `CouponService`, `checkout`,
  `orders`, `payments`, `inventory`, `reviews`, `wishlist`, `accounts`, `users-admin` ->
  `UsersAdminService`, `cms`, `banners`, `settings`, `newsletter`, `contact`, `dashboard`, `audit`,
  `email` -> `EmailService` (in `src/lib/email/index.ts`)). Session helpers: `src/lib/auth/session.ts`
  (`SessionHelpers`); cookie helpers: `src/lib/session/cookies.ts` (`CookieHelpers`).
- A compile-time check file `src/lib/services/_contract-check.ts` assigns each module namespace to its
  interface (`const _: CatalogService = catalog`) so drift fails `tsc`.
- Files in `src/lib/services` starting with `_` are internal helpers (pricing, coupon rules, catalog read model, CSV,
  text folding, order lifecycle). Do not import them from outside the services folder. A few services export extras
  beyond their interface that are safe to use: `inventory.availableOf`, `reviews.recomputeProductRating`,
  `coupons.releaseCouponRedemption`, `shipping.priceMethod/methodServes`, `tax.matchTaxRate`,
  `checkout.applyPaymentEvent` (webhooks), `accounts.purgeUser`, `banners.bannerIsLive`.
- Services are the only code that uses `getDb()`. Read-modify-write sequences run inside
  `db.transaction(...)`. Order placement is one transaction around reserve+create; the (mock) payment call
  happens inside the same flow and rolls back stock on decline.
- Services throw `DomainError(code, { params })` (`src/lib/errors.ts`) for expected failures. Codes are the
  keys of `errors.*` in `messages/_src/common.*.json` (section 14 lists them). Unexpected errors bubble.
- Every admin write logs an audit entry (`action` = `entity.verb`, e.g. `product.update`,
  `order.refund`, `user.role_change`, `settings.update`) with small `changes` diffs.
- Performance: the JSON repositories keep collections in memory (write-through, atomic file replace),
  so reads are cheap. Do not add caches in services. Listing functions paginate (`Paged<T>`).
- Search: tokenised, case/diacritic-insensitive match (Turkish `ı/İ`, `ş`, `ğ` folded) over names in
  both locales, SKU, part/OEM numbers, brand, tags, with scoring (exact part number > name prefix > substring).

## 6. Money and currency

- Everything stored or computed is **integer USD cents**. Floats never touch money.
- Display currency by locale: `en` -> USD, `tr` -> TRY using `settings.currency.tryPerUsd` (admin editable).
- Convert **only at the presentation edge** with `src/lib/money.ts`:
  - server: `const ctx = await getCurrencyContext(locale)` (settings service) then `formatMoney(cents, locale, ctx)`;
  - client components receive a `CurrencyContext` prop (never fetch settings) and call `formatMoney`.
  - `<Price amount compareAt locale currency />` renders prices (tabular figures, strike-through, `-23%`).
- Orders freeze `currency`, `fxRate`, and `chargedTotal = round(total * fxRate)` at placement. The payment
  provider charges `chargedTotal` in `currency`. Refunds are expressed in USD base and converted with the
  frozen `fxRate`.
- Tax is **exclusive** (added on top) using `TaxRate.rateBps` matched by country/region. Shipping may be taxed
  per `appliesToShipping`. Discounts are applied before tax; order-level discounts are allocated to lines with
  `allocate()` so line sums equal the total.
- Admin price inputs are USD (label the unit). Use `parseMajorToMinor` / `minorToMajorString`.

## 7. Server Actions

### 7.1 Result type (mandatory)

```ts
// src/lib/action-result.ts
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorParams?: Record<string, string | number>; fieldErrors?: Record<string, string[]> };
```

- `error` is a code translated via `errors.<code>`; each `fieldErrors` entry is a code translated via
  `validation.<code>`. Never return English prose. Use `useErrorText()` (`src/lib/hooks/use-error-text.ts`)
  to render them.
- Wrap handlers with `runAction(schema, rawInput, async (input) => data)`: it zod-validates, maps
  `DomainError` -> `{ok:false}`, logs unexpected errors and returns `error: "unknown"`. `redirect()`/`notFound()`
  inside a handler propagate correctly.
- Actions accept `unknown` raw input (never trust types across the wire) and validate with a zod schema whose
  messages are validation codes (`src/lib/validation/common.ts` has building blocks).
- Auth: first line of every protected action is `await assertUser()` / `await assertStaff("permission")`.
  Public mutating actions (newsletter, contact, review, coupon apply, login) call `rateLimit()` first.
- After a successful mutation call the relevant `revalidatePath` (`src/lib/cache.ts` exports
  `revalidateStore()`, `revalidateAdmin(path?)`, `revalidateAccount()`).
- Forms: `react-hook-form` + `zodResolver` on the client for UX, **the server schema is authoritative**.
  Show field errors from `result.fieldErrors`, a banner `Alert` for `result.error`.
- File layout: `src/actions/<area>/<topic>.ts` (`"use server"`), schema in `<topic>.schema.ts`.

### 7.2 Cookies (httpOnly, SameSite=Lax, Secure in production)

| Cookie | Purpose | Lifetime |
|---|---|---|
| `better-auth.session_token` | session (managed by Better Auth; `__Secure-` prefix on https) | 14 days sliding |
| `cart_id` | anonymous/current cart id | 60 days |
| `vehicle` | JSON `VehicleSelection` | 1 year |
| `admin_locale` | admin UI language | 1 year |
| `apexline-theme` (localStorage) | per-viewer theme override | n/a |

### 7.3 Cross-area exported actions (stable names)

| Module | Exports |
|---|---|
| `@/actions/store/cart` | `addToCartAction({variantId, quantity})`, `setCartQuantityAction({variantId, quantity})`, `removeFromCartAction({variantId})`, `applyCouponAction({code})`, `removeCouponAction()`, `getCartAction()` -> `CartView \| null` |
| `@/actions/store/wishlist` | `toggleWishlistAction({productId})` -> `{inWishlist, count}` |
| `@/actions/store/vehicle` | `setVehicleAction(VehicleSelection)`, `clearVehicleAction()` |
| `@/actions/store/newsletter` | `subscribeNewsletterAction({email, source})` |
| `@/actions/account/auth` | `signInAction`, `signUpAction`, `signOutAction`, `requestPasswordResetAction`, `resetPasswordAction`, `changePasswordAction` (use `auth.api.*` server-side with the `nextCookies` plugin; run lockout + rate-limit; on sign-in merge the guest cart with `mergeGuestCart`). **Ready-made implementation:** `@/lib/auth/credentials` exports `signInWithPassword`, `signUpWithPassword`, `signOutCurrentUser`, `requestPasswordReset`, `resetPasswordWithToken`, `changePasswordForCurrentUser`, `signInStaff`, `revokeUserSessions`. They already do rate limiting, password policy, lockout mapping, `DomainError` translation (no user enumeration) and the guest-cart merge, so actions are just `runAction(schema, raw, (i) => signInWithPassword(i))` + `revalidate*`/`redirect`. |
| `@/actions/admin/auth` | `adminSignInAction({email, password, next})` (use `signInStaff`), `adminSignOutAction()`, `setAdminLocaleAction(locale)` |

The cart drawer/button (`CartButton`, `CartDrawer`) are Store components mounted by `SiteHeader`; Account
and Checkout layouts reuse `SiteHeader`/`SiteFooter`, so the cart is available everywhere except the minimal
checkout header.

## 8. API route handlers

- Thin: parse + validate (zod) -> auth check -> call service -> JSON. Use helpers from `src/lib/api/respond.ts`
  (`json(data, init)`, `problem(error)`, `handle(fn)`, `readJson(request, schema)`, `validate(schema, input)`,
  `assertSameOrigin(request)`, `csvResponse`); errors serialise as `{ error: code, errorParams?, fieldErrors? }` with
  HTTP status from `DomainError.status` (400/401/403/404/409/429/500) and `Retry-After` on 429. Cookie-authenticated
  writes require a JSON content type and a same-origin `Origin` header (`assertSameOrigin`). `src/lib/api/cart-context.ts`
  (`resolveCart`) resolves "the current cart" (signed-in user's cart, else the signed `cart_id` cookie).
- Same `rateLimit()` on every public write. Staff routes call `assertStaff(permission)` and write audit entries.
- Responses never contain secrets, password hashes, session tokens, `accessToken` of other users' orders, or cost prices
  (for non-staff).
- JSON responses are `Cache-Control: no-store` unless explicitly public and safe (`/api/products*` may use
  `public, s-maxage=30, stale-while-revalidate=120` when no cookie-dependent filter is applied).

## 9. Auth, sessions, RBAC

- **Better Auth** (`src/lib/auth/auth.ts`): email+password, `minPasswordLength` 10, sessions in the JSON store via
  `src/lib/auth/json-adapter.ts` (`createAdapterFactory`; maps `user -> users`, `account -> authAccounts`,
  `session -> authSessions`, `verification -> authVerifications`), `nextCookies()` plugin, `additionalFields`
  on user: `role`, `locale`, `phone`, `disabled`, `marketingOptIn`. Cookie cache **off** so role/disabled changes apply
  immediately. Password reset and verification emails go through the email outbox.
- Use only the helpers in `SessionHelpers` (`getSessionUser`, `requireUser`, `requireStaff`, `assertUser`,
  `assertStaff`, `can`, `toActor`). Never read the cookie or call Better Auth from UI code. `can` and
  `permissionsFor` also live in the pure module `src/lib/permissions.ts`, importable from client components to
  hide links (never a security boundary). The order status graph is likewise pure: `src/lib/order-status.ts`
  (`canTransition`, `nextStatuses`, `wasPaid`, `isRefundable`).
- Lockout and disabled-account checks live inside the Better Auth instance (hooks), so they also protect direct
  `/api/auth/*` calls. Behind a reverse proxy set `TRUST_PROXY=true`, otherwise every visitor shares the IP bucket
  `direct` (lockout/rate limits then apply per email only / globally).
- Roles: `customer`, `staff`, `admin`. Permission matrix (enforced by `can`):

| Permission | staff | admin |
|---|:--:|:--:|
| `dashboard.read`, `catalog.read`, `orders.read`, `customers.read` | yes | yes |
| `catalog.write`, `inventory.write`, `orders.write`, `reviews.moderate`, `marketing.write`, `cms.write` | yes | yes |
| `orders.refund`, `settings.write`, `users.manage`, `audit.read` | no | yes |

- Login protection: 5 failed attempts per email+IP -> 10 minute lockout (`loginAttempts` collection); generic
  `invalid_credentials` message (no user enumeration); `rateLimit` per IP.
- Disabled users: sessions revoked on disable; sign-in rejected with `account_disabled`.
- Seed accounts (development only, documented in README): `admin@apexline.example`, `staff@apexline.example`,
  `customer@apexline.example` (password printed in README; never reused in production).

## 10. Orders, inventory, payments

Status graph (enforced in `orders.updateOrderStatus` and the dedicated actions):

```
pending_payment -> processing | cancelled
processing      -> shipped | cancelled
shipped         -> delivered
delivered       -> refunded            (via full refund)
shipped|delivered|processing -> (partial refunds keep status, paymentStatus = partially_refunded)
cancelled, refunded are terminal
```

- `paymentStatus`: `unpaid -> paid -> partially_refunded | refunded`, or `failed`.
- Stock lifecycle (all inside transactions): `placeOrder` **reserves** (`stockReserved += q`); payment success
  **commits** (`stockOnHand -= q`, `stockReserved -= q`, movement `sale`); decline/expiry **releases**; cancel or
  refund with `restock` **restocks** (`stockOnHand += q`, movement `return`). Pending orders older than
  `reservationMinutes` are released lazily by `releaseExpiredReservations()`.
- Checkout is **idempotent** on `idempotencyKey` (client generates one UUID per checkout attempt and keeps it
  across retries of the same cart). Replaying a key returns the original result (`succeeded`, or the same
  `requires_action` challenge); after a **decline** the same key retries on the same order (same number/token, rebuilt
  from the current cart). A different customer using the key gets `duplicate_order`. `placeOrder` runs in three phases:
  (1) one transaction validates, prices, reserves stock and creates the `pending_payment` order, (2) the provider is
  called with no lock held, (3) a second transaction commits stock / releases it. `expectedTotal` (optional) makes a stale
  price fail with `price_changed`.
- Refunds (`refundOrder`) are issued through the provider first, then applied atomically. A complete refund before
  shipping ends as `cancelled`; after shipping as `refunded`. Shipping is refundable once (`Refund.includesShipping`).
  Cancelling a paid order refunds the remainder (or, with `refund: false`, only handles stock). Customers see orders
  with `internalNotes` removed and staff identities hidden.
- Guests can view their confirmation with the order `accessToken` (`?t=`); `getOrderByNumber(number, access)`
  returns `null` when not permitted (treat as 404).
- Emails (outbox files under `data/outbox/`): order confirmation, shipping update, refund notice, password reset,
  email verification, staff invite, contact acknowledgement. Admin can browse them at `/admin/emails`.
- **Mock payment provider** (`src/lib/payments/mock.ts`), selected by `PAYMENT_PROVIDER=mock`:

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` (any other Luhn-valid number) | success |
| `4000 0000 0000 0002` | `card_declined` |
| `4000 0000 0000 9995` | `insufficient_funds` |
| `4000 0000 0000 0069` | `expired_card` |
| `4000 0000 0000 0119` | `processing_error` |
| `4000 0025 0000 3155` (also `4000 0000 0000 3220`) | `requires_action` (3-D-Secure style: UI shows a challenge modal -> `completePaymentAction`) |

  Token payments (`{ type: "token" }`): `tok_visa`, `tok_mastercard` (success), `tok_chargeDeclined`,
  `tok_insufficientFunds`, `tok_threeDSecure`. `PAYMENT_PROVIDER` selects the provider; webhooks arrive at
  `/api/webhooks/payments` signed with `PAYMENT_WEBHOOK_SECRET` (`x-apexline-signature: t=<unix>,v1=<hmac>`; helper
  `signWebhookPayload` in `src/lib/payments`). Mock latency: `MOCK_PAYMENT_LATENCY_MS` (default 350 ms, 0 in tests).

  Expiry must be in the future, CVC 3-4 digits, Luhn must pass (validation codes `card_*_invalid`). Raw card
  data is never stored: only brand, last4, expiry. A Stripe adapter slot implements the same `PaymentProvider`.

## 11. i18n

- Locales: `en` (default), `tr`. `localePrefix: "always"`. Routing/navigation in `src/i18n/*`.
- **Message fragments** (avoid merge conflicts): write messages in `messages/_src/<fragment>.<locale>.json`
  (e.g. `store.product.en.json` + `store.product.tr.json`). `npm run messages` deep-merges all fragments into
  `messages/en.json` and `messages/tr.json` (run automatically by `predev` and `prebuild`;
  `npm run messages:watch` while developing; `npm run messages:check` validates without writing).
  The build fails on: missing counterpart file, key present in one locale only, differing ICU argument names,
  empty values, duplicate keys across fragments, non-string leaves.
- **Namespace ownership**: a fragment may only define keys under namespaces its area owns:
  Foundation `common`, `errors`, `validation`, `ui`, `pages`, `email`, `seo`; Store `store`; Account `account`, `auth`;
  Checkout `checkout`; Admin `admin`. Nest by feature: `store.product.addToCart`. Never put two areas' keys
  in the same fragment file.
- Do not edit generated `messages/en.json` / `tr.json` by hand.
- In components: server `await getTranslations("store.product")`, client `useTranslations("store.product")`.
  Keys are camelCase, values are full sentences (no string concatenation across keys), use ICU
  placeholders/plurals (`{count, plural, one {# item} other {# items}}`). **Turkish must be real Turkish**
  (use `ç ğ ı İ ö ş ü`), not English copy. Turkish plurals take the singular noun after numerals.
- Data translations: stored `LocalizedString {en, tr}`; render with `localize(value, locale)` (falls back to `en`).
  Admin forms edit both languages side by side and warn when `tr` is empty (`isLocalizedComplete`).
- Admin: locale from `admin_locale` cookie; `getLocale()`/`getTranslations()` work unchanged (see `src/i18n/request.ts`).
- Dates/numbers: `useFormatter()` / `getFormatter()` (timeZone UTC); money via `formatMoney`.
- `<html lang>` is set by the root layouts. Language switcher: `LocaleSwitcher` (storefront); admin has its own.
- SEO: every storefront page exports `generateMetadata` with localised title/description and `alternates.languages`.

## 12. UI system

- Tokens live in `src/app/globals.css` (`:root` with `light-dark()`); Tailwind utilities: `bg-background`, `bg-surface`,
  `bg-surface-sunken`, `bg-inverse`, `text-foreground`, `text-muted`, `text-subtle`, `border-border`, `bg-primary`
  (+`text-primary-foreground`), `text-primary-text` (orange as text), `bg-accent`, `bg-secondary`, status colours
  `success|warning|danger|info` (+`-soft`), fonts `font-display` (Barlow Condensed) / `font-sans` (Inter).
- **Never** use `dark:` variants or raw hex/`rgb()` in components; both themes come from tokens.
  Orange (`bg-primary`) always carries graphite text (`text-primary-foreground`), never white.
- Type utilities: `display-1..4`, `label-caps`, `num` (tabular figures; use for prices, qty, table numbers).
  Three voices: Barlow Condensed uppercase for page and section titles (h1, h2); Inter for everything else (h3/h4 are
  sentence-case semibold); JetBrains Mono (`font-mono`) for data. Mono utilities: `mono` (tabular, slashed zero), `part-no`
  (uppercase tracked part / OE / SKU numbers, the signature typography), `tag-mono` (micro labels, spec strips, `§ 01`).
  Body measure <= 70ch (`max-w-prose`).
- Shape utilities: `chamfer` / `chamfer-sm` (cut-corner tag silhouette, primary CTA & price tags only), `ruler`
  (measurement hairline divider), `skeleton`, `container-page` (page width + fluid gutters).
- Drafting-sheet identity (the one ownable device): `reg-marks` (1px frame + corner registration crosshairs, colour via
  `--reg-c`), `grid-paper` / `sheet-grid` (millimetre paper), `hatch`. The fixed light drawing paper has its own tokens
  (`bg-sheet`, `text-sheet-ink`, `text-sheet-muted`, `border-sheet-line`, `text-sheet-accent`) that do not flip with the
  theme; use them only for the hero sheet and 404 plates. Shared pieces in `@/components/shared`: `PartPlate` / `PartNo`
  (part number data plate with OE refs, SKU and copy buttons; use it wherever a part number is shown), `SheetHeading`
  (numbered section header `§ 02` + ruler + link), `ServiceSpec` (ruled guarantees table, replaces icon trust rows),
  `PreferencesMenu` (language + theme in one menu), `NotFoundSheet`.
- Motion: one authored moment, the drafting reveal. Home hero linework draws itself (`draw-in`, `tick-in`; shapes carry
  `pathLength="1"`); the product image is "plotted" left to right behind a pen line (`plotter`, `plotter-pen`); a part
  plate stamps into the cart (`stamp-in`). All collapse under `prefers-reduced-motion`.
- Primitives in `@/components/ui` (barrel `index.ts`): `Button` + `buttonStyles()` (for links), `Input`,
  `Textarea`, `Select`, `Checkbox` (also radio), `Switch`, `Field` (label/hint/error wiring), `Badge`, `Card*`, `Alert`,
  `Modal` (dialog / right-left drawer), `ToastProvider` + `useToast()` (already mounted by root layouts), `Table*`,
  `Pagination`, `Breadcrumbs`, `Tabs`, `Skeleton*`, `Spinner`, `Price`. Shared: `ThemeToggle`, `LocaleSwitcher`.
  Brand: `Logo` (`variant` auto|light|dark|mono, `layout` lockup|mark|wordmark), `LogoMark`, `Wordmark`.
  Check `/en/styleguide` (dev) to see all of them in both themes.
- Use `Field` for every form control (gives label, hint, error, aria wiring). Error text from `useErrorText()`.
- Link-buttons: `<Link className={buttonStyles({ variant: "outline" })}>`; Pagination/Breadcrumbs take `linkAs`
  (storefront: i18n `Link`; admin: `next/link`).
- Store pages are Persuade/Experience mode: confident, product-led, strong imagery, one authored motion moment,
  no identical entrance animation per section. Admin is Operate mode: dense, scannable tables, consistent
  toolbars, predictable forms; brand shows in details only.
- Section numbers are allowed only as the drawing-sheet device (`§ 01` on one baseline with the title, never stacked above it).
- Banned looks: eyebrow/kicker labels above headings, gradient text, glass-blur decoration, left-border accent
  cards, nested cards, hero-metric template, emoji/unicode as icons (use lucide-react at one stroke weight),
  identical icon+heading+text card grids as the page skeleton.
- Accessibility: AA contrast, visible `:focus-visible`, 44px touch targets on primary controls, semantic landmarks
  (`<main id="main">`, skip link), labelled form controls, `aria-live` for async results, `prefers-reduced-motion`
  respected (global rule), keyboard-operable menus/dialogs, no information by colour alone.
- Images: product art is SVG under `public/products/**` (generated). `next/image` with `.svg` requires `unoptimized`;
  alt text from `ProductImage.alt` localised. Always set `width/height` or `fill`+`sizes` (no layout shift).
- Responsive: mobile-first, test 360px and 1280px, no horizontal page scroll, tables inside `TableContainer`.
- Loading/empty/error states are required for every data view (Skeleton, empty copy with a next action, `Alert`).

## 13. Security baseline

- Headers (CSP, HSTS, frame-ancestors none, nosniff, referrer policy, permissions policy) in `next.config.ts`.
- Server Actions are same-origin only (Next built-in origin check); all cookies `SameSite=Lax`, `HttpOnly`.
- `rateLimit({ key, limit, windowMs })` (`src/lib/security/rate-limit.ts`, in-memory sliding window) on auth, contact,
  newsletter, reviews, coupon apply, checkout. Key = route + ip (+ email). `TRUST_PROXY` controls `X-Forwarded-For`.
- Validate every input with zod; escape on output (React does); never `dangerouslySetInnerHTML` user content.
  CMS/product markdown is rendered by `<Markdown>` (`src/components/ui/Markdown.tsx`) which supports headings,
  paragraphs, lists, bold/italic, links (http/https/relative only), tables, hr - raw HTML is dropped.
- Uploads: staff only, allow-list `image/png|jpeg|webp|avif|svg+xml` (SVG sanitised/rejected if it contains script),
  <= 5 MB, random filenames, served with a sandbox CSP.
- Secrets only from env (`src/lib/env.ts` validates). Never log PII, passwords, card data or tokens.
- Structured logger `src/lib/logger.ts` (`logger.info(event, fields)`), JSON lines in production.

## 14. Domain error codes (binding)

Services throw these `DomainError` codes; each has `errors.<code>` in both languages:
`unknown, validation_failed, not_found, forbidden, unauthorized, conflict, rate_limited, invalid_credentials,
account_locked, account_disabled, email_taken, invalid_token, weak_password, password_incorrect, out_of_stock,
insufficient_stock, variant_unavailable, product_unavailable, quantity_invalid, cart_empty, cart_not_found,
price_changed, coupon_invalid, coupon_expired, coupon_not_started, coupon_used_up, coupon_min_subtotal,
coupon_not_applicable, shipping_unavailable, shipping_method_invalid, address_invalid, guest_checkout_disabled,
payment_declined, payment_insufficient_funds, payment_expired_card, payment_failed, payment_requires_action,
payment_authentication_failed, refund_exceeds_paid, refund_failed, order_not_found, order_not_cancellable,
invalid_status_transition, duplicate_order, vehicle_not_found, slug_taken, sku_taken, code_taken, in_use,
last_admin, cannot_modify_self, file_too_large, file_type_not_allowed, csv_invalid, already_subscribed, maintenance`.
Need a new code? Add it to `common.en.json` + `common.tr.json` (Foundation) and to this list.

Validation codes (`validation.*`): `required, too_short, too_long, email_invalid, phone_invalid, url_invalid,
slug_invalid, password_too_short, password_weak, passwords_mismatch, number_invalid, integer_required,
must_be_positive, must_not_be_negative, too_large, date_invalid, date_range_invalid, country_invalid,
postal_code_invalid, card_number_invalid, card_expiry_invalid, card_cvc_invalid, invalid_value, terms_required,
rating_required, select_required`.

## 15. Data, seed and persistence

- `src/lib/db/seed/*.ts` define the seed (typed with `domain.ts`; the folder lives inside `src/lib/db` so replacing
  the persistence layer replaces the seed with it). On first access `getDb()` seeds `DATA_DIR`
  (`data/runtime/<collection>.json`, gitignored; a `_meta.json` marker is written last). `npm run seed:reset` wipes
  runtime data and re-seeds (a running server notices the new seed within a second and reloads its cache). Seed ids are deterministic (`prd_001`, `ord_100450`).
  Seed modules do not import `server-only` (scripts import them); everything else in `src/lib/db` does, so
  scripts that touch the store run under `tsx --conditions=react-server` (see `package.json`).
- Persistence engine (`src/lib/db/json/*`): lazy load + in-memory cache; every commit writes `<file>.<pid>.<n>.tmp`,
  fsyncs and renames over the target (atomic); a commit touching several collections goes through a roll-forward
  journal (`_journal.json`) so a crash leaves either all or none of it. One process-wide FIFO mutex (30 s acquisition
  timeout) serialises writes; backups are not kept (this is a stand-in for a real DB).
- Repository semantics: reads and writes are deep copies (callers may mutate what they get); rows are normalised
  through JSON so memory always equals what a reload would give; `update`/`upsert` treat a key set to `undefined` as
  "remove the field"; `where` predicates must be pure. `insert` rejects duplicate ids (`DuplicateIdError`), `update`
  rejects missing rows (`RecordNotFoundError`); services translate these into `DomainError`s.
- Transactions are copy-on-write: invisible to other readers until commit, discarded when the callback throws,
  and **ambient** (AsyncLocalStorage): any `getDb().repo()` / `db.<collection>` call made inside the callback, for
  example from another service function, joins the running transaction instead of deadlocking on the mutex.
  Nested `transaction()` calls join the outer one with savepoint rollback. Never keep a `tx` reference after the
  callback returns (`TransactionClosedError`).
- Entry points: `getDb()` (contract) and the `db` facade (`db.products.find(...)`, `db.transaction(...)`), both from
  `@/lib/db`. `createId(prefix)`/`createToken()` live in `src/lib/db/id.ts`. Zod schemas for every entity are in
  `src/lib/types/schemas.ts` (`collectionSchemas`), used by the seed integrity tests.
- Seed content: 10 categories (Brakes, Engine, Suspension, Filters, Lighting, Electrical, Exhaust, Cooling, Body,
  Fluids) with 49 subcategories, 28 invented brands, 122 products with 1-3 variants each, specs, fitment for 42
  vehicle configurations (281 model-year rows), 3 documented dev users (admin, staff, customer; credentials in
  `src/lib/db/seed/credentials.ts` and README) plus 10 extra demo customers, 37 sample orders in every status,
  reviews, coupons, banners, 6 CMS pages, shipping methods, tax rates, settings. All user-visible seed text is
  bilingual. No real manufacturer or trademarked *part* brand names (vehicle makes/models are real, used nominatively
  for fitment).
- Product art: `npm run art:products` (`scripts/generate-product-art.ts`) deterministically generates the SVGs in
  `public/products/` from the seed catalogue as engineering line drawings: view 1 is an orthographic elevation on drawing
  paper with centrelines, dimension lines and numbered bubbles (the numbers match the specification rows chosen by
  `src/lib/spec-dims.ts`), view 2 a graphite section drawing (cutting plane A-A, callouts), plus category plates, brand
  badges and banners. `scripts/art/blueprint.ts` restyles the shaded part drawings in `parts-a/b.ts` into two-weight line art
  and measures them for the dimensions. Re-run it whenever products or specs are added to the seed.
- Swap path to a real DB: implement `Database`/`Repository` (`src/lib/db/contracts.ts`) with Prisma/Drizzle, swap
  the Better Auth adapter, set `getDb()` to return it. A Prisma schema draft mirrors `domain.ts` (`docs/prisma-draft.prisma`).

## 16. Caching and rendering

- `cacheComponents` / `use cache` are **not** enabled. Pages that read cookies (cart, vehicle, session) are dynamic;
  catalog data is served from the in-memory repositories so dynamic rendering is cheap.
- `generateStaticParams` only for `[locale]`. Mutating actions call `revalidatePath` helpers from `src/lib/cache.ts`.
- Use `Suspense` boundaries around slow sections (reviews, related products) so the page shell streams.

## 17. Testing

- Unit (vitest): `tests/unit/**` for services, money, coupons, tax, shipping, orders status graph, stock reservation,
  search, message build script. Services are tested against a temp `DATA_DIR`.
- E2E (Playwright, `npm run test:e2e`): browse -> vehicle filter -> cart -> coupon -> guest checkout with mock card
  (success + decline + 3DS) -> order in admin -> status change -> stock decrement -> locale switch -> admin refund.
- A change is not done until `npm run messages:check`, `npx tsc --noEmit`, `npm run lint`, `npm test` and
  `npm run build` pass for the touched area.

## 18. Environment

See `.env.example`. Required in production: `BETTER_AUTH_SECRET` (>= 32 chars), `BETTER_AUTH_URL`,
`NEXT_PUBLIC_APP_URL`. `DATA_DIR` must be on a persistent volume. The app runs as a single Node process (the JSON
store's mutex is process-local); scale-out requires the DB swap.

---

## Appendix: contract source files

Verbatim copies; edit the `.ts` files, then run `npm run docs:arch`.

### A. Domain types - `src/lib/types/domain.ts`

<!-- BEGIN:src/lib/types/domain.ts -->
```ts
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
```
<!-- END:src/lib/types/domain.ts -->

### B. Persistence contract - `src/lib/db/contracts.ts`

<!-- BEGIN:src/lib/db/contracts.ts -->
```ts
/**
 * PERSISTENCE CONTRACT. Services depend ONLY on these interfaces (via `getDb()` from src/lib/db).
 * UI, Server Actions and route handlers never touch repositories or JSON files directly.
 *
 * Today: JSON-file implementation (src/lib/db/json/*): in-memory map per collection, atomic write
 * (write temp file + rename), single process-wide mutex for write transactions, first boot copies
 * seed data from src/lib/db/seed into DATA_DIR. Later: swap `getDb()` for a Prisma/Drizzle-backed
 * implementation of the same interfaces. Nothing above this layer changes.
 */
import type { Id } from "@/lib/types/domain";

/** Every persisted collection and its entity type (type-level registry). */
export interface CollectionMap {
  users: import("@/lib/types/domain").User;
  addresses: import("@/lib/types/domain").Address;
  categories: import("@/lib/types/domain").Category;
  brands: import("@/lib/types/domain").Brand;
  products: import("@/lib/types/domain").Product;
  variants: import("@/lib/types/domain").ProductVariant;
  vehicleMakes: import("@/lib/types/domain").VehicleMake;
  vehicleModels: import("@/lib/types/domain").VehicleModel;
  vehicles: import("@/lib/types/domain").Vehicle;
  fitment: import("@/lib/types/domain").FitmentRow;
  reviews: import("@/lib/types/domain").Review;
  carts: import("@/lib/types/domain").Cart;
  orders: import("@/lib/types/domain").Order;
  payments: import("@/lib/types/domain").Payment;
  inventoryMovements: import("@/lib/types/domain").InventoryMovement;
  coupons: import("@/lib/types/domain").Coupon;
  couponRedemptions: { id: Id; couponId: Id; orderId: Id; userId: Id | null; email: string; at: string };
  shippingMethods: import("@/lib/types/domain").ShippingMethod;
  taxRates: import("@/lib/types/domain").TaxRate;
  wishlists: import("@/lib/types/domain").Wishlist;
  pages: import("@/lib/types/domain").CmsPage;
  banners: import("@/lib/types/domain").Banner;
  settings: import("@/lib/types/domain").StoreSettings;
  newsletter: import("@/lib/types/domain").NewsletterSubscriber;
  contactMessages: import("@/lib/types/domain").ContactMessage;
  auditLog: import("@/lib/types/domain").AuditEntry;
  searchLog: { id: Id; q: string; resultCount: number; at: string };
  reviewVotes: { id: Id; reviewId: Id; voterKey: string; at: string };
  /** Better Auth tables, stored through the same adapter: */
  authAccounts: { id: Id; userId: Id; providerId: string; accountId: string; password?: string | null; createdAt: string; updatedAt: string };
  authSessions: { id: Id; userId: Id; token: string; expiresAt: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string; updatedAt: string };
  authVerifications: { id: Id; identifier: string; value: string; expiresAt: string; createdAt: string; updatedAt: string };
  loginAttempts: { id: Id; key: string; failures: number; lockedUntil?: string | null; updatedAt: string };
}

export type CollectionName = keyof CollectionMap;

export interface QueryOptions<T> {
  where?: (row: T) => boolean;
  orderBy?: { field: keyof T & string; direction: "asc" | "desc" }[];
  offset?: number;
  limit?: number;
}

export interface Repository<T extends { id: Id }> {
  get(id: Id): Promise<T | null>;
  getMany(ids: Id[]): Promise<T[]>;
  all(): Promise<T[]>;
  find(options?: QueryOptions<T>): Promise<T[]>;
  findOne(where: (row: T) => boolean): Promise<T | null>;
  count(where?: (row: T) => boolean): Promise<number>;
  /** `id` generated (`createId()`) when omitted. Rejects on duplicate id. */
  insert(row: Omit<T, "id"> & { id?: Id }): Promise<T>;
  /** Shallow merge. Rejects when missing. */
  update(id: Id, patch: Partial<Omit<T, "id">>): Promise<T>;
  /** Insert-or-replace. */
  upsert(row: T): Promise<T>;
  delete(id: Id): Promise<boolean>;
  deleteWhere(where: (row: T) => boolean): Promise<number>;
}

export interface Database {
  repo<K extends CollectionName>(name: K): Repository<CollectionMap[K]>;
  /**
   * Run `fn` as an exclusive write transaction (process-wide mutex): reads inside see the latest
   * committed state and all writes become visible together; if `fn` throws, nothing is persisted.
   * Use it for any read-modify-write that must be atomic (stock reservation, order numbering,
   * coupon redemption, checkout).
   */
  transaction<R>(fn: (tx: Database) => Promise<R>): Promise<R>;
}

/** Entry point: `const db = getDb();` (src/lib/db/index.ts) - lazily seeds on first use. */
export type GetDb = () => Database;
```
<!-- END:src/lib/db/contracts.ts -->

### C. Service contracts - `src/lib/services/contracts.ts`

<!-- BEGIN:src/lib/services/contracts.ts -->
```ts
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
```
<!-- END:src/lib/services/contracts.ts -->

### D. Money helpers - `src/lib/money.ts` (exports)

`Currency`, `CurrencyContext`, `USD_CONTEXT`, `currencyForLocale`, `currencyContextFor`, `convertFromBase`,
`convertToBase`, `formatMinor`, `formatMoney`, `parseMajorToMinor`, `minorToMajorString`, `applyBps`, `percentOf`,
`allocate`, `discountPercent`.

### E. Action/error helpers - `src/lib/action-result.ts`, `src/lib/errors.ts`

`ActionResult`, `ok`, `fail`, `zodFieldErrors`, `runAction`; `DomainError`, `notFound`, `conflict`, `forbidden`,
`unauthorized`, `isDomainError`.

---

## CHANGES (Foundation B: services, auth, payments, API)

Deviations from and additions to the contract as first written. The `.ts` contract files are the source of truth;
the appendix above is refreshed from them.

**Contract changes (all additive, existing callers keep compiling)**

- `PaymentProvider.verifyWebhook(rawBody, signature)` and the `PaymentWebhookEvent` type were added
  (`src/lib/services/contracts.ts`); the Stripe slot verifies real Stripe signatures, the mock uses an HMAC scheme.
  The task text called the provider methods `createIntent/confirm/refund/webhook verify`; the contract names
  (`charge`, `confirmAction`, `refund`, `verifyWebhook`) win.
- `PlaceOrderInput.expectedTotal?: Cents` (optional stale-price guard -> `price_changed`).
- Domain: `Refund.includesShipping?: boolean`, `Order.cartId?: Id` (+ matching zod schemas).
- `4000 0000 0000 3220` is accepted as an additional 3-D-Secure test card next to `4000 0025 0000 3155`.
- `zodFieldErrors` now maps zod's built-in English messages to validation codes (`required`, `too_long`, ...),
  so `fieldErrors` never contain prose.
- `env.ts`: new `OUTBOX_DIR`, `MOCK_PAYMENT_LATENCY_MS`, `PAYMENT_WEBHOOK_SECRET`, `STRIPE_*`; production now also
  requires `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` and a non-default `PAYMENT_WEBHOOK_SECRET`; `env.ts` imports `server-only`.

**Additions beyond the written contract**

- `src/lib/auth/credentials.ts` (ready-made sign-in/up/out, reset, change password, staff sign-in), `password-links.ts`
  (staff invite / admin-triggered reset links), `client.ts`; `src/lib/permissions.ts` and `src/lib/order-status.ts`
  (pure, client-safe); `src/lib/api/{respond,cart-context}.ts`; `src/lib/uploads.ts`; `src/lib/{logger,cache}.ts`;
  `src/lib/security/{rate-limit,lockout,ip}.ts` (`rateLimit()` throws `rate_limited`, `enforceRateLimit(name, opts)` keys by
  route + client IP).
- Session helpers: `requireRole(roles)` / `assertRole(roles)` next to `requireStaff` / `assertStaff` (role gates; prefer permissions).
- Email: `sendWelcome`, `sendAdminNewOrder`, `sendContactToStaff` in addition to `EmailService`; the outbox lives in
  `OUTBOX_DIR` (default `<DATA_DIR>/../outbox`, i.e. `data/outbox`).
- Routes: `/api/cart/coupon` (POST/DELETE) and `/uploads/[...path]` (serves uploaded files at runtime; Next only
  serves `public/` files that existed at build time).
- `releaseExpiredReservations()` also cancels stale `failed` pending orders (they hold no stock) and runs lazily from
  `placeOrder` and `adminListOrders`; it will therefore cancel the seeded unpaid demo orders on first use.
- Search: Turkish possessive/plural endings are stripped for matching (`balatasi` -> `balata`); `didYouMean` uses edit distance.

**Known limitations / decisions**

- `settings.inventory.allowBackorders` is stored but not honoured (the stock model has no negative on-hand).
- Coupon minimum spend is checked against the whole cart subtotal; the `coupon_min_subtotal` error carries only
  `min` (USD minor units); `useErrorText().actionError(result, currency)` formats it into the `amount` message param.
- `refundOrder` with no `amount`/`items` refunds everything left. A complete refund of a `processing` order becomes a
  cancellation; of a `shipped`/`delivered` order it becomes `refunded`.
- Manual `pending_payment -> processing` (graph edge) marks the order paid by hand (stock committed, `manual_<number>` ref).
- Lockout keys use the client IP only when `TRUST_PROXY=true` (see Auth); the stored key is a hash.
- Vitest inlines `better-auth` (`vitest.config.ts`) so tests can mock `next/headers` for its Next.js cookie plugin.

**Tests (Foundation B)**

- `tests/unit/services/*.test.ts` (catalog, cart, coupons, checkout incl. the concurrent last-unit race and idempotent replays,
  orders incl. every status transition and refund path, inventory, vehicles/fitment, search, engagement, accounts/users,
  content/settings/tax/shipping/dashboard/audit, platform: payments/rate limit/csv/email/cookies/permissions, auth),
  `tests/unit/api/routes.test.ts` (every route handler called with real `Request` objects) and `tests/unit/env.test.ts`.
  They run against a throwaway `DATA_DIR`, outbox and upload folder created by `tests/unit/helpers/test-env.ts`
  (import it FIRST in a service test; `freshSeed()` re-seeds). Route tests mock `next/headers` with a cookie jar.
  Route-handler tests live in `tests/unit/api` (not `tests/api`) so a single `vitest run` covers them.
