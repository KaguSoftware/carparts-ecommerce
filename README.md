# APEXLINE Auto Parts

A complete car-parts e-commerce site: storefront, accounts, checkout with a mock payment gateway, admin panel,
REST/API layer, English and Turkish. Persistence is JSON files behind repository interfaces, so a real database
can replace them later without touching business logic or UI.

- **Storefront**: vehicle finder ("Find parts for your car", remembered in a cookie), category / brand / search
  with facets, product pages with fitment checker, cart drawer, guest and account checkout, order tracking,
  wishlist, reviews, CMS pages, newsletter, contact form, SEO (metadata, sitemap, robots, JSON-LD).
- **Admin** (`/admin`): dashboard, products + variants, categories, brands, fitment, inventory with history,
  orders (ship / deliver / cancel / refund), customers, reviews moderation, coupons, shipping and tax, banners and
  CMS pages, store settings, staff and roles, audit log, email outbox, CSV import / export.
- **Signature**: a scroll-driven 3D exploded view of a Honda K24 style engine on the home page (see
  [Engine teardown](#engine-teardown-3d)) and a drafting / workshop-manual visual identity (hairline grids,
  numbered balloons, part-number typography, generated line-drawing product art).
- **Backend**: zod-validated Server Actions and route handlers, Better Auth (email + password, sessions, password
  reset, roles), idempotent checkout with stock reservation inside a write transaction, server-side pricing,
  rate limiting and login lockout, security headers / CSP, env validation, structured logging, `/api/health`.

The binding technical contract is [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick start

Requirements: Node.js 22 or newer, npm.

```bash
npm install
cp .env.example .env.local      # optional in development: every variable has a development default
npm run dev                     # http://localhost:3000  (redirects to /en)
```

On the first request the JSON "database" in `data/runtime` is created from the seed (122 products, 42 vehicle
configurations, orders, reviews, coupons, CMS pages, ...). Delete it or run `npm run seed:reset` to start over.

### Seeded credentials (development only)

These accounts exist **only** when the data directory is seeded outside production, or in production with
`SEED_DEMO_DATA=true`. A normal production first boot creates a single administrator instead (see
[Deployment](#deployment)).

| Role | Email | Password |
|---|---|---|
| Admin | `admin@apexline.example` | `Admin#Apex2026!` |
| Staff | `staff@apexline.example` | `Staff#Apex2026!` |
| Customer | `customer@apexline.example` | `Customer#Apex2026!` |

Nine more demo customers (`sofia.marino@mail.example`, ...) share the customer password; `victor.hale@mail.example`
is a disabled account. Admin sign-in is at `/admin/login`, customer sign-in at `/en/login`.

Coupons for testing: `WELCOME10` (10 percent, first order), `SAVE25` (25 USD off orders of 150 USD or more),
`FREESHIP` (free shipping from 75 USD).

Mock card numbers (the mock gateway never contacts a network):

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | approved |
| `4000 0000 0000 0002` | declined |
| `4000 0000 0000 9995` | insufficient funds |
| `4000 0000 0000 0069` | expired card |
| `4000 0000 0000 0119` | processing error |
| `4000 0025 0000 3155` | 3-D-Secure style challenge |

Use any future expiry date and any 3-digit security code. Test cards are listed on the checkout page in
development only.

## Brand

Name, tagline and contact details live in `src/config/brand.ts` (one constant to rename the store). Palette and
type tokens live in `src/app/globals.css`, with light and dark themes:

| Token | Value | Use |
|---|---|---|
| Graphite | `#14171c` | text, dark surfaces |
| Steel | `#2b313a` | secondary surfaces |
| Signal orange | `#ff5a1f` | primary / calls to action |
| Amber | `#ffb020` | accents, highlights |
| Paper | `#f4f5f7` | page background |

Headings use Barlow Condensed, body text uses Inter and data (part numbers, specs, order numbers) uses JetBrains Mono
(via `next/font`). The logo (a drafted apex chevron on a dimension line, plus wordmark) is drawn in code in `src/components/brand`; `npm run brand:assets` regenerates
`public/logo*.svg`, the favicon (`src/app/icon.svg`) and the social image. Product imagery is generated SVG engineering
drawings (`npm run art:products`), so no copyrighted photos are involved.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack). `predev` compiles the translation fragments |
| `npm run build` / `npm start` | Production build (standalone output) / start it with `next start` |
| `npm run messages` / `messages:check` / `messages:watch` | Merge `messages/_src/*` into `messages/{en,tr}.json`; validate en/tr parity |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm test` | Vitest unit tests (services, API routes, env, auth, i18n, data layer) |
| `npm run test:e2e` | Playwright end-to-end suite (see [Testing](#testing)) |
| `npm run seed:reset` | Wipe `DATA_DIR` and re-seed (a running dev server reloads automatically) |
| `npm run docs:arch` | Refresh the appendix of ARCHITECTURE.md from the contract `.ts` files |
| `npm run brand:assets` | Regenerate logo, favicon and social image from the React logo |
| `npm run art:products` | Regenerate the SVG product art in `public/products` from the seed catalogue |

## Environment variables

Copy `.env.example`; it documents every variable. Validation lives in `src/lib/env.ts` and fails fast with a
readable message.

| Variable | Dev default | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public origin: canonical URLs, sitemap, emails. **Required in production** |
| `BETTER_AUTH_URL` | | Auth callback origin. **Required in production** |
| `BETTER_AUTH_SECRET` | built-in dev secret | **Required in production**: 32+ random characters, placeholders rejected |
| `PAYMENT_WEBHOOK_SECRET` | built-in dev secret | **Required in production**: same rules. Signs webhooks and 3-D-Secure tokens |
| `TRUST_PROXY` | `false` | **Must be set explicitly in production.** `true` only behind a proxy that overwrites `X-Forwarded-For` |
| `PAYMENT_PROVIDER` | `mock` | `mock` or `stripe` |
| `ALLOW_MOCK_PAYMENTS` | unset | The mock gateway is refused in production unless this is `true` (demos only) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | unset | Required when `PAYMENT_PROVIDER=stripe` in production |
| `MOCK_PAYMENT_LATENCY_MS` | `350` | Artificial gateway latency; `0` disables it |
| `DATA_DIR` | `data/runtime` | JSON store; must be on a persistent volume in production |
| `UPLOAD_DIR` | `public/uploads` | Admin image uploads, served from `/uploads` |
| `OUTBOX_DIR` | `<DATA_DIR>/../outbox` | Email outbox (no SMTP) |
| `EMAIL_PROVIDER`, `EMAIL_FROM` | `outbox` | Sender address for outbox emails |
| `SEED_DEMO_DATA` | unset | `true` seeds the demo people / orders / credentials in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin@apexline.example`, random | Production first-boot administrator (password 12+ characters) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Architecture

```text
src/
  app/[locale]/(store|account|checkout)/   storefront, account area, checkout (en / tr in the URL)
  app/admin/                               admin panel (language from the admin_locale cookie)
  app/api/                                 route handlers: cart, products, search, vehicles, health, webhooks, exports
  actions/                                 Server Actions (store, account, checkout, admin)
  components/                              ui primitives, brand, store, account, checkout, admin
  i18n/                                    next-intl routing, request config, typed navigation
  lib/db/                                  repository contracts, JSON-file implementation, seed
  lib/services/                            catalog, cart, checkout, orders, inventory, coupons, accounts, search, ...
  lib/payments/                            PaymentProvider interface, mock gateway, Stripe adapter slot
  lib/auth/                                Better Auth + JSON-file adapter, credentials flows, sessions
  lib/email/                               Mailer interface + file outbox, templates (en / tr)
  lib/security/                            rate limiter, login lockout, client IP
  proxy.ts                                 Next 16 proxy (locale routing, cheap admin / account cookie gate)
messages/_src/                             translation fragments; messages/{en,tr}.json are generated
tests/unit, tests/e2e                      Vitest and Playwright
data/                                      runtime JSON store (gitignored)
```

Layering: UI and Server Actions call **services**; services call **repositories** (`db.products`, `db.orders`,
...) and the **payment / mail providers** through their interfaces. Nothing above `src/lib/db` knows that data is
stored in JSON files. The proxy only does a cheap session-cookie check; real authorization (session + role +
permission) happens in server components (`guard()`) and again in every Server Action.

Money is integer USD cents everywhere; the Turkish storefront displays TRY using a fixed, configurable rate in
the store settings, recorded on the order at placement.

## Engine teardown (3D)

The home page has a full-width "Engine Teardown" section: a procedural Honda K24 style inline-four (valve cover, cams with VTEC
rockers, head, valves, gasket, block, pistons, rods, crank, pan, manifolds, timing chain) that explodes as you scroll, orbits on
drag and links every part to its shop category. It is built from three.js primitives only, so no model files or manufacturer CAD
ship with the repository.

- Code: `src/components/engine3d/` (`@react-three/fiber` + `@react-three/drei` + `three`), copy in `messages/_src/engine3d.*.json`.
- The 3D chunk is lazy-loaded (`next/dynamic`, `ssr: false`) only when the section nears the viewport. A static SVG blueprint is
  rendered first and stays for `prefers-reduced-motion`, data saver, weak devices and browsers without WebGL (3D is then opt-in).
- It renders on demand, pauses offscreen, caps DPR and keeps vertical swipes scrolling on touch devices.
- Every part is a link: the legend rows, the blueprint balloons and the 3D label card all use `partHref()` in `parts.ts`
  (a subcategory such as `/category/engine-oil`, or `/search?q=piston` for parts the seed has no subcategory for).
  `tests/unit/engine3d-parts.test.ts` and `tests/e2e/store-engine.spec.ts` check that every target exists and resolves.

### Replacing the procedural model with a `.glb`

The scene rig and the legend only depend on **node names**, so a real model drops in without touching them. Full details:
[src/components/engine3d/README.md](./src/components/engine3d/README.md#replacing-the-procedural-model-with-a-glb).

1. Model the engine assembled (1 unit = 100 mm, Y up, crankshaft along X) with one node per part, named exactly like the part
   ids in `src/components/engine3d/parts.ts`: `valveCover`, `camshafts`, `camGears`, `rockerArms`, `cylinderHead`, `valves`,
   `headGasket`, `block`, `pistons`, `conrods`, `crankshaft`, `oilPan`, `intakeManifold`, `exhaustManifold`, `timingChain`.
   Put each part's pivot at the origin so the explode offsets in `parts.ts` mean the same thing.
2. Export glTF binary (`.glb`) with Draco or Meshopt compression and PBR materials, no baked lights, ideally under 1.5 MB. Use
   your own or properly licensed models; do not ship manufacturer CAD.
3. Save it as `public/models/engine.glb`.
4. In `src/components/engine3d/EngineStage.tsx` replace the procedural model with the file, inside a `<Suspense fallback={null}>`:

   ```tsx
   import { useGLTF } from "@react-three/drei";

   function GlbEngine() {
     const { scene } = useGLTF("/models/engine.glb"); // Draco: useGLTF(url, "/draco/") with the decoder hosted under public/draco
     return <primitive object={scene} />;
   }
   // <EngineRig ...><GlbEngine /></EngineRig>   instead of   <ProceduralEngine />
   ```

5. Keep `parts.ts` (ids, shop links, explode offsets) and retune the offsets there if your model's proportions differ. Once the
   `.glb` works you can delete `src/components/engine3d/model/`. The CSP only allows same-origin assets, so host the model and any
   Draco decoder under `public/`.
6. Verify with `npx tsc --noEmit`, `npx vitest run` and `npm run test:e2e`, then look at the home page in the 3D, reduced-motion
   and no-WebGL modes.

## Data layer

`src/lib/db/contracts.ts` defines `Repository<T>` (`get`, `find`, `insert`, `update`, `upsert`, `delete`, ...)
and `Database` (`repo(name)`, `transaction(fn)`). The JSON implementation (`src/lib/db/json/*`) keeps each
collection in memory, writes each commit to `<collection>.json` atomically (temp file, fsync, rename), and
serialises write transactions behind a process-wide mutex; a transaction that throws persists nothing. Checkout,
stock reservation, order numbering and coupon redemption all run inside `db.transaction`.

Persistence survives restarts: the files in `DATA_DIR` are loaded on boot and the seed only runs when the
directory is empty.

### Swapping the JSON store for Postgres / Prisma

A schema draft with one model per collection is in [`docs/prisma-draft.prisma`](./docs/prisma-draft.prisma).

1. `npm i @prisma/client && npm i -D prisma`, copy the draft to `prisma/schema.prisma`, set `provider =
   "postgresql"` and `DATABASE_URL`. Add `@relation` blocks and enums where wanted, then `npx prisma migrate dev`.
2. Create `src/lib/db/prisma/` implementing `Repository<T>` for each collection. `where` predicates in `find`,
   `findOne`, `count` and `deleteWhere` are JavaScript functions today; either translate the call sites to
   structured filters (a handful of services) or load candidates and filter in memory for the first iteration.
3. Implement `Database.transaction(fn)` with `prisma.$transaction` (use `SELECT ... FOR UPDATE` or
   `Serializable` isolation for stock reservation and coupon redemption, which rely on the JSON mutex today) and
   hand `fn` a `Database` whose repositories use the transaction client.
4. Point `createDefaultDatabase()` in `src/lib/db/index.ts` at the new implementation (selected by a
   `DATABASE_URL` env var). `getDb()`, `db.*` and every service stay untouched.
5. Replace the Better Auth adapter in `src/lib/auth/auth.ts` (`database: jsonFileAdapter()`) with
   `prismaAdapter(prisma, { provider: "postgresql" })` from `better-auth/adapters/prisma`, and remove the
   `auth*` repositories.
6. Load the seed into the database once: write a script that calls `buildSeedRows()` from
   `src/lib/db/seed` (and `toProductionSeed()` for a production-shaped load) and inserts each collection.
   To migrate existing JSON data, read every `DATA_DIR/<collection>.json` file and insert its rows as they are.
7. Remove the process-local per-order refund lock in `src/lib/services/orders.ts` in favour of a row lock, and
   lift the "single instance" restriction.
8. Run `npm test` (the service tests exercise the contract) and `npm run test:e2e`.

## Payments

Checkout talks to the `PaymentProvider` interface (`charge`, `confirmAction`, `refund`, `verifyWebhook`) via
`getPaymentProvider()`. The mock gateway implements it with the test cards above, 3-D-Secure style challenges,
idempotency keys and signed webhooks. Late webhooks and charges that succeed after an order was cancelled are
reconciled (audited and auto-refunded).

### Switching to Stripe

1. `npm i stripe`; set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; remove
   `ALLOW_MOCK_PAYMENTS`.
2. Fill in `charge`, `confirmAction` and `refund` in `src/lib/payments/stripe.ts`. The file contains a step by
   step guide (PaymentIntents with an idempotency key, `requires_action` mapping, refunds). Webhook signature
   verification and event normalisation are already in place.
3. Replace the raw card fields in `src/components/checkout` with Stripe Elements: the browser sends
   `{ type: "token", token: "pm_..." }` (the `PaymentInput` type already has that variant), so card numbers
   never reach the server.
4. Register `https://<your-host>/api/webhooks/payments` in the Stripe dashboard for `payment_intent.succeeded`,
   `payment_intent.payment_failed` and `charge.refunded`.

## Internationalisation

- Locales: `en` (default) and `tr`, routed as `/en/...` and `/tr/...`. Catalogue content (names, descriptions,
  specs, CMS pages) is stored as `{ en, tr }` and edited in both languages in the admin.
- UI strings live in `messages/_src/<fragment>.<locale>.json`. **Edit the fragments, never the generated
  `messages/en.json` / `messages/tr.json`.** After editing run `npm run messages` (also runs on `dev` and
  `build`); it fails on a missing locale, key mismatch or differing ICU arguments between `en` and `tr`.
- To add a locale: add it to `src/i18n/routing.ts`, create `<fragment>.<locale>.json` for every fragment, extend
  the `LOCALES` list in `scripts/build-messages.mjs`, and add its currency / rate in the store settings.
- Errors are domain codes (`errors.*` messages), so services never return localized text.

## Testing

```bash
npm test                 # Vitest: 310+ unit and API tests (312 at the last full run)
npx playwright install chromium
npm run test:e2e         # builds the app, starts it on port 3100 with a throw-away data directory
```

The Playwright config (`playwright.config.ts`) creates `data/e2e-<run id>/` for every run (store, outbox and
uploads), starts the production build with demo seeding enabled, and deletes the directory afterwards
(`E2E_KEEP_DATA=1` keeps it, `E2E_SKIP_BUILD=1` reuses the existing `.next` build, `E2E_PORT` changes the port).
Covered flows: guest browse to cart to checkout with a mock card to confirmation, declined card, coupon,
admin sign-in, new order visible in admin with status change and stock check, vehicle selector filtering,
English to Turkish switch, customer blocked from `/admin`, 404 status codes, 360px layout, and the home page Engine Teardown
(canvas or blueprint fallback renders, every part link resolves to a valid shop route).

## Deployment

### Production first boot

With `NODE_ENV=production` and no `SEED_DEMO_DATA`, an empty `DATA_DIR` is seeded with the catalogue, vehicles,
settings, content, shipping and tax data, plus **one administrator**: `ADMIN_EMAIL` (default
`admin@apexline.example`) with `ADMIN_PASSWORD` (12+ characters). If `ADMIN_PASSWORD` is not set, a random
password is printed once to the log. No demo customers, orders or reviews are created. Change the admin password
after the first sign-in and keep `DATA_DIR` on a persistent volume.

Production refuses to start with weak or placeholder secrets, without an explicit `TRUST_PROXY`, and with the
mock payment gateway unless `ALLOW_MOCK_PAYMENTS=true` is set (use that only for demos).

### Docker

```bash
docker build -t apexline .
docker run -p 3000:3000 \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e PAYMENT_WEBHOOK_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL=https://shop.example -e NEXT_PUBLIC_APP_URL=https://shop.example \
  -e ADMIN_EMAIL=owner@shop.example -e ADMIN_PASSWORD='a-long-unique-password' \
  -e ALLOW_MOCK_PAYMENTS=true \
  -v apexline-data:/app/data -v apexline-uploads:/app/public/uploads apexline
```

The image is multi-stage (`node:22-alpine`), runs as a non-root user, sets `TRUST_PROXY=true` (terminate TLS at a
proxy that overwrites `X-Forwarded-For`; override with `-e TRUST_PROXY=false` otherwise), stores data in
`/app/data/runtime` and uploads in `/app/public/uploads`, and has a healthcheck on `/api/health`.

### Without Docker

```bash
npm ci && npm run build
cp -r .next/static .next/standalone/.next/static     # the standalone output omits static assets and public/
cp -r public .next/standalone/public
NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 TRUST_PROXY=true \
  BETTER_AUTH_SECRET=... PAYMENT_WEBHOOK_SECRET=... \
  BETTER_AUTH_URL=https://shop.example NEXT_PUBLIC_APP_URL=https://shop.example \
  ADMIN_PASSWORD=... ALLOW_MOCK_PAYMENTS=true \
  node .next/standalone/server.js
```

`GET /api/health` returns `{ "status": "ok", ... }` (HTTP 503 with `"degraded"` when the data store cannot be
read); point load balancers at it.

### Operational notes

- Run a **single Node instance** until the database swap: the JSON store's mutex and the rate limiter are
  process-local.
- Emails are written to the outbox (`/admin/emails` to browse them). For real delivery implement `Mailer` in
  `src/lib/email/mailer.ts` (SMTP, SES, Resend ...), return it from `getMailer()` and add its name to the `EMAIL_PROVIDER` enum in `src/lib/env.ts`.
- Back up `DATA_DIR` and `UPLOAD_DIR` together. If `UPLOAD_DIR` is not the default, make sure it is served as
  `/uploads` (the `/uploads/[...path]` route does this).
- The CSP allows inline scripts because Next.js injects bootstrap scripts; tighten it with nonces if you move to
  fully dynamic rendering.

## Known limitations

- JSON persistence, in-memory rate limiting and per-order refund locks are single-process; see the Prisma steps.
- Payments are mocked and emails go to a file outbox until a real provider and mailer are wired in.
- The Turkish storefront shows TRY using a fixed rate, not live exchange rates.
- The Stripe adapter is a documented slot and has not been exercised against Stripe.
- `docs/prisma-draft.prisma` is a draft and has not been checked with `prisma validate`.
- The Docker image has not been built in CI; the standalone server (`node .next/standalone/server.js`) was
  smoke-tested. `next start` prints a harmless warning about `output: standalone`.
- A signed-in customer who opens an `/admin` URL sees a "No access" page rather than being redirected.
- The 3D engine is procedural and stylised, not manufacturer CAD (see the `.glb` guide above).
- Visual QA was done by automated screenshots and agent review; have a human review the design before launch.
