# Changelog

## 2026-10-06 — Cart, product cards, product page, checkout (user-directed)
Uncommitted at time of writing; rebased onto main 3f5e169 ("added brand
name to shows" — its card fallback "Manufest Weaves" was kept). Backup of
the pre-pull state: `D:/manufest_code/backup_2026-10-06/` (CHANGES.md
there lists every item). Needs manufest_be's same-day changes for the
seller brand on cart lines and `inStock` on cards.

- **Checkout address form:** a new address's Label starts as "Home"
  (editable; editing an existing address keeps its own label).
- **OTP auto-verify:** `app-otp-input` emits `(completed)` when an
  autofill/paste (more than one digit at once) fills every box; typing digit
  by digit never emits it. Login and the account's mobile verification
  call their verify method on it, guarded by `submitting()`/`verifying()`
  so a second autofill can't send twice.
- **Product card:**
  - seller brand under the name (`sellerLabel`: brand → seller name →
    "Manufest Weaves");
  - "+ Add to cart" on a product with several active variants shows that
    product's colour swatches in the card (name chip when a variant has no
    colour, × to close); a swatch opens `/product/:uuid?variant=<uuid>`;
  - **Go to cart** (logo-ribbon gradient, `--color-logo-magenta`) once any
    variant of the product is in the cart;
  - **out of stock up front** when `inStock === false` (missing = in stock):
    frosted "Out of stock" band at the bottom of the photo, photo lightly
    muted, grey price, disabled "Currently unavailable" button. Go to cart
    still wins when the product is already in the cart.
- **Product page:** opens on `?variant=` when it names a variant (else the
  first); "Colour: <name>" beside the swatches (+ `title` on each);
  sub-category in the breadcrumb; details list adds Colour, Fabric, Weave,
  Zari colour, Blouse (Included / Not included, sarees only), Blouse length,
  Occasion (multi-values comma-joined via `names()`); `lengthLabel()` adds
  " m" to a bare number. Details are label/value rows (values left-aligned)
  on mobile and a two-column grid (label above value) above 900px.
  "Add to cart" becomes **Go to cart** when the selected variant is in the
  cart (`selectedVariantInCart`). `ProductAttributes` gained `fabrics` and
  `weaves`.
- **Cart:** "Select all" is a bordered bar with "N of M selected"
  (out-of-stock items not counted), part-filled checkbox when only some are
  selected, highlighted while anything is selected; 18px checkboxes. Each
  line shows "by <brand>" (`CartItem.seller.brandName`).
- **Cart quantity correctness** (wrong totals reported on iPhone):
  `CartService` numbers each mutation and ignores a response older than
  one already applied; busy state is per item (`pendingItems` set, not a
  single uuid); cart and checkout subtotals are summed in whole paise;
  +/- buttons have `touch-action: manipulation` (no iOS double-tap zoom)
  and are 36px on phones.
- **Checkout:** the parcel-video note is now a "Good to know" box under
  Place order, rendered from the `orderNotes` array (add a string to add a
  bullet; empty array hides the box).
- **Header announcement:** "Free shipping · Secure payments via UPI, cards
  & net banking" (no ₹2,999 minimum).
- **Tests:** new `login.component.spec.ts` and `cart.service.spec.ts`;
  additions in account, cart, checkout, header, otp-input, product-card and
  product-detail specs (291 total, all passing).

## 2026-10-04 – 2026-10-05 — Storefront fixes and tweaks (user-directed)
Uncommitted at time of writing. Grouped by area:

- **Navigation / scroll:** back/forward now restores the previous scroll
  position instead of jumping to the top (`core/scroll/scroll-restoration.ts`,
  see 00-overview.md). Product detail reloads when its `:productUuid`
  changes in place, so "You may also like" cards open the clicked product
  (`route.paramMap` instead of `snapshot`; in-flight requests for the old
  product are cancelled).
- **Product cards:** show only the cheapest variant's price (was a
  "₹57.98 – ₹64.47" range). `manufest_be`'s `THUMBNAIL_ORDER_SQL`
  (products.api.js) now picks the thumbnail from the cheapest priced variant
  that has media (primary image first), falling back to the next-cheapest.
- **Price filter:** four shared `PRICE_BANDS` (Under ₹299 / ₹1,000 / ₹2,000,
  ₹3,000 and above) for the listing sidebar and the header's Shop by Price
  menu; details and the ₹2,000–₹3,000 gap in 02-product-listing.md.
  "Clear all" is now a highlighted pill button.
- **Origin hidden** in the header and listing sidebar (one-line restores).
  A district+state ("Tenkasi, TN") feature was built across manufest_be,
  manufest_seller and this app, then **fully reverted** at the user's
  request, including dropping the `seller_registration.state` column from
  the local DB and its `schema_migrations` row.
- **Account:** profile edit has an Email field (backend `PATCH /profile`
  accepts `email`, unverified; `''` clears it; 409 `EMAIL_TAKEN` shown under
  the field). Email is sent only when changed (trim + lower-case compare) so
  an unchanged address keeps `email_verified_at`. Sidebar shows the mobile
  number and the email on separate lines, each only if present.
- **Addresses (account + checkout):** Country is read-only "India (IN)".
  Checkout: phone field renamed "Receiver's phone number" and pre-filled
  from the customer's `mobileNumber`; each saved address has an **Edit**
  button (sibling of the radio `<label>`, so it doesn't change the
  selection) that reuses the inline form ("Edit address" / "Update
  address", `updateAddress`), keeping that address selected after saving.
- **iOS Safari layout fixes:** header burger bars (explicit width +
  `appearance: none`); date-of-birth input gets a custom down arrow and
  min-height; cart thumbnail uses fixed px sizes (was `aspect-ratio`), which
  stopped the quantity stepper/Remove row overlapping "Proceed to checkout".
  Cart thumbnail is also larger: 104×130 desktop, 88×110 phone.
- **Reverted the same day:** an "add to cart always adds in place +
  up-front Out of stock" change to the product card (and its backend
  `inStock` field). The card behaves as before: multi-variant products open
  the detail page.
- **Not from this work, but present in the tree:** `shared/otp-timer/`
  (live "Code valid for m:ss" readout used by login and account), related
  login edits, and `environment.ts` (production!) currently pointing
  `apiBaseUrl` at `http://localhost:4000` — must be switched back to
  `https://manufestweaves.in/api/v1` before any production build.
- **Known open issue:** date of birth shifts back a day on save for IST
  users (`account.component.ts` slices the UTC ISO string). Fix agreed to be
  backend-side (return/accept plain `YYYY-MM-DD`); not done yet.
- **Tests added:** `scroll-restoration.spec.ts`; `account.component.spec.ts`
  (sidebar lines, email edit/validation/EMAIL_TAKEN, India-only country);
  `product-filters.models.spec.ts` (bands, chip labels);
  `product-listing.component.spec.ts` (Origin hidden, price band
  select/clear/active); `header.component.spec.ts` (Origin hidden, Shop by
  Price links); product-detail (route change reloads); checkout (receiver
  phone pre-fill/label, edit address flow); product-card (cheapest price).
  CSS-only fixes have no automated tests. `app.config.spec.ts` now guards
  `scrollPositionRestoration: 'disabled'` + `provideScrollRestoration()`.
- **Verified:** `ng test --watch=false` 236/236 passing;
  `ng build --configuration development` clean.

## 2026-09-29 — Checkout is online-payment only (COD and bank transfer hidden)
- **Why:** the business isn't taking cash on delivery for now; only
  Razorpay (cards, UPI, net banking, wallets).
- `checkout.component.ts` has `offlinePaymentsEnabled = false` and
  defaults `paymentMethod` to `'razorpay'`; the COD and bank-transfer
  options in `checkout.component.html` render only when that flag is true.
  The backend still accepts `cod`/`manual`, so flipping the flag is the
  only change needed to bring them back.
- The header announcement bar no longer says "Cash on delivery available".

## 2026-09-28 — Shared paise-aware price formatting; cart "price changed" notice removed
- **New `core/utils/format-price.ts`:** a single `formatPrice()` for every
  rupee amount in the app. It shows paise only when there are any
  (`₹2,730.90`, but `₹2,731`) and uses Indian grouping (`₹1,00,000`). It
  replaces seven copies of `` `₹${Math.round(n).toLocaleString('en-IN')}` ``
  in the cart, checkout, order-detail, orders, product-detail, wishlist and
  product-card components. Rounding paise away made the checkout total
  differ from what Razorpay charged. It works in integer paise
  (`Math.round(n * 100)`), so float noise such as `0.1 + 0.2` or `1999.999`
  formats cleanly.
- **Cart:** removed the "Price changed since you added this (was ₹…)" notice
  at the user's request. That removed the `priceChanged()` method, its
  `.cart-item__price-changed` style and its tests. `CartItem.priceAtAdd` is
  still in the model; it just isn't displayed any more.
- **Tests:** added `format-price.spec.ts` (whole rupees, paise, Indian
  grouping, float noise). Added "price display" specs to the cart
  (rendered price shows paise; the notice no longer renders) and checkout
  (subtotal shown to the paisa). The product-card spec now expects
  `₹1,999.60` rather than the old rounded `₹2,000`. Order-detail, orders
  and wishlist have no spec files yet, so their `formatPrice` delegation
  isn't directly tested.
- **Verified:** `ng test --watch=false` shows 160/160 passing, and
  `tsc -p tsconfig.app.json` is clean.

## 2026-09-10 (fifth pass) — Shop by Category alignment fix + real category icons
The user flagged that the design itself has this problem too ("even the
figma also same but its a design mistake but we should do that
correctly"): `manufest_be`'s dev DB only seeds 3 categories
(Blouses/Dress Materials/Sarees), but `.cat-grid` was a fixed
`repeat(6, minmax(0,1fr))` CSS Grid — 3 real tiles hugging the left edge,
3 blank grid tracks on the right, next to Shop by Occasion/Price rows
that always render exactly 6 items (both are static lists, not API-driven)
and so always look "full" by comparison.

- `.cat-grid`/`.cat-tile` (`home.component.scss`) converted from CSS Grid
  to a flex row with a **fixed** tile width (`flex: 0 0 170px`) and
  `justify-content: center` — centers whatever number of tiles actually
  exist instead of either leaving dead space (the original bug) or
  stretching few tiles to fill the whole row (what a naive `grid-
  template-columns: repeat(auto-fit, minmax(0,1fr))` fix would have done
  — 3 items would each balloon to ~1/3 of the row width, inconsistent
  with Occasion/Price's tile size). Shop by Occasion/Price weren't
  touched — they're hardcoded 6-item lists with no count-mismatch
  possible.
- Categories with no `image_url` (or a broken one) now fall back to a
  small original line icon matched by name — a blouse silhouette, a
  folded-fabric icon, or draped-saree lines for names containing
  "blouse"/"dress material"/"saree" respectively (`categoryIconFor()` in
  `home.component.ts`) — instead of a bare initial letter. Anything that
  doesn't match still falls back to the letter. These are hand-drawn SVG
  paths original to this change, not sourced from anywhere, and not a
  substitute for real category photos once `image_url` is populated with
  working ones.
- **Not done (flagged to the user, not implemented):** an AI-generated
  image capability for the remaining placeholder photo slots (hero,
  manufacturer spotlight, grow-business, review avatars) — this
  environment has no image-generation tool available, and pulling
  arbitrary photos off the web to stand in as this business's brand/
  product photography would be a real copyright/licensing risk for a
  commercial site. Offered custom SVG illustrations (same treatment as
  the category icons above) as an alternative if wanted for those slots
  too; not yet built pending the user's answer.
- **Verified:** `ng build`, `ng test --watch=false`, and a Playwright
  screenshot of just `.cat-grid` at 375px/1440px (no horizontal overflow)
  all pass clean.

## 2026-09-10 (fourth pass) — Footer rebuilt to match the design exactly, with a background-image slot
Previously a single flat-maroon band (`--color-footer-bg`) with a
text-only "Manufest" wordmark and a bottom copyright bar the design
doesn't actually have. Rebuilt as the design's real two-tone layout, at
the user's explicit request:
- `.footer__about` — a cream (`--color-bg-tint`) panel: the real logo mark
  (`BRAND_ASSETS.logoMark`, same asset the header uses) stacked above the
  "Manufest" wordmark and a tagline, then three icon-led contact rows
  (email, two phone numbers) — copied verbatim from the design's own
  static contact info (`manufest@gmail.com`, `9876543210`, `044 -
  234567`), same "match the design's static content" instruction as the
  home-page content in the entry above.
- `.footer__links` — the Shop/Sell/Help columns on a photo-backed panel
  instead of flat maroon. No real photo exists yet, so
  `footer.component.scss` layers a maroon-tinted `linear-gradient(...)`
  under a `url('/assets/footer/footer-background.jpg')` that currently
  404s harmlessly (each CSS background layer fails independently — the
  gradient still renders). Drop a real photo at that exact path and it
  picks it up with no further code change — see that file's own comment.
- Social icons (Instagram/Facebook/YouTube, plus a new fourth — Threads,
  which the design has but this footer didn't yet) moved from a separate
  full-width bottom bar into the Help column itself, matching where the
  design actually places them. The bottom copyright bar
  ("© 2026 Manufest...") was removed entirely — it doesn't exist in the
  design's footer at all, full stop, not even the mobile/tablet frames.
- **Verified:** `ng build`, `ng test --watch=false`, and a Playwright
  screenshot of just the `.footer` element at 375/900/1440px (no
  horizontal overflow at any) all pass clean.

## 2026-09-10 (third pass) — Home page brought to full pixel parity with the design, at the user's explicit direction
The user shared a fuller render of `ui_design/Home Page.png` and asked for
pixel parity, including sections this repo had previously and
deliberately dropped for having no backing `manufest_be` data — the
project's established "don't fabricate" convention (see the first
2026-09-10 CHANGELOG entry below, and `home.component.ts`'s prior header
comment) is explicitly superseded for these sections by direct user
instruction, not silently reversed.

- **Shop by Occasion** is back as a static section (six fixed tiles,
  circular like the design, initial-letter placeholder same as Shop by
  Category's fallback) — still no public endpoint to fetch real occasion
  values from, so tiles link to unfiltered `/new-arrivals`.
- **Manufacturer spotlight** (Annapoorna Handloom Works quote), **stat
  counters** (8,000+ Happy Customers, etc.), **"Grow your business with
  Manufest"** (a new seller-recruitment CTA section not present in the
  earlier design pass), and **customer review cards** ("Trusted by
  thousands of customers") are all now static placeholder content, copied
  from the design mock. Reviewer names were varied instead of literally
  repeating the design's one name five times (which read as a design-tool
  duplication artifact, not intentional).
- **Flagged, not resolved:** the review cards present named
  testimonials + 5-star ratings as if real, with no reviews module behind
  them. This is a materially different risk than a generic seasonal-sale
  banner — fabricated endorsements/ratings are a known FTC-disclosure
  problem in the US and analogous consumer-protection rules elsewhere.
  Documented prominently in `home.component.ts`'s header comment; replace
  with real review data (or clearly label as sample) before this ships to
  production.
- Four photo slots (`hero`, `spotlight`, `grow`, `review`) use a new
  shared `.ph-image` placeholder — the same missing-thumbnail icon
  `product-card`/`product-detail` already use, recolored per section via
  a modifier class, instead of a fabricated stock photo or a broken `<img
  src="">`. Swap each for a real `<img>` once photo assets exist — see
  the `TODO(design swap)` comments in `home.component.html`.
- `angular.json`'s `anyComponentStyle` budget raised (6kB/10kB →
  9kB/14kB warning/error) — `home.component.scss` legitimately grew past
  the old budget with this much added content; not a sign of unnecessary
  bloat to trim.
- **Verified:** `ng build`, `ng test --watch=false`, and a Playwright pass
  against the running dev server at 375px/1440px (no horizontal overflow
  at either) all pass clean.

## 2026-09-10 (second pass) — Mobile nav rebuilt as an off-canvas drawer, ported from manufest_seller
Follow-up to the same-day audit below, prompted by a direct side-by-side
comparison the user did between this app's mobile hamburger menu and
`manufest_seller`'s sidebar/topbar mobile pattern — the seller app's was
judged clearly better (a slide-in panel with a brand header, icon+label
rows, and a circular avatar button) versus this app's plain inline-
expanding list. Since every manufest_* frontend is the same product
family, the fix was to visually port the validated pattern rather than
re-derive a worse one — see `header.component.ts`'s header comment for the
full mapping back to `manufest_seller/layout/{sidebar,seller-shell,
topbar}.component.*`.

- `shared/header/`: the mobile/tablet nav (≤1023px) is now a fixed
  off-canvas drawer (`header__drawer`, `min(300px, 84vw)` wide,
  `translateX` transition) with a backdrop (`header__scrim`) that closes
  it on click, a brand header with a close (×) button, `routerLinkActive`
  highlighting on the current nav item, and a per-item inline icon (new
  SVGs: sparkle for New Arrivals, pin for Origin, swatch grid for Fabric,
  interlace lines for Weave, gift box for Occasion) — same "icon key +
  template `@switch`" convention `manufest_seller/layout/sidebar/
  sidebar.component.*` uses for its own nav. A Wishlist/My account footer
  section was added to the drawer (those already existed as icon-only
  buttons in the header's actions row for desktop/tablet — this just also
  surfaces them inside the mobile drawer itself). The account/profile icon
  also gained a circular avatar treatment (`header__avatar`) matching
  `manufest_seller`'s `.topbar__avatar`, instead of a bare icon.
- `styles.scss`: `.container` gained a `≤480px` step (14px side padding,
  down from 16px) — matches `manufest_seller`'s `.shell__content` 28/18/14
  cascading padding steps instead of this app's previous single
  767px-and-below step.
- **Verified:** a scripted Playwright pass confirmed the drawer opens via
  the hamburger, `routerLinkActive` correctly marks exactly one nav item,
  and it closes via both the visible scrim strip and the × button, at
  375px and 900px viewports. (First pass mis-clicked the scrim's
  bounding-box center, which falls *under* the drawer itself at narrow
  viewports where the drawer occupies most of the screen width — not a
  real bug, just a reminder that a full-viewport scrim needs a
  visible-area click point in a headless test, not its bbox center.)
  `ng build` and `ng test --watch=false` both pass clean.

## 2026-09-10 — Real product-listing/browse page, design/responsive audit, security fixes
Driven by `manufest_be`'s same-day filterable-listing change
(`categoryUuid`/`occasionUuid`/`priceMin`/`priceMax`/`sort` on `GET
/public/products/list`) plus a design/UI review against the repo's new
`ui_design/` reference set. See [02-product-listing.md](02-product-listing.md)
for the listing page in full, and [01-home-page.md](01-home-page.md)'s
updated table for the Home page changes.

- **New:** `features/product-listing/` — real filterable/sortable product
  browsing page, serving both `new-arrivals` and `category/:categoryUuid`
  routes (previously `new-arrivals` was a "coming soon" placeholder;
  `category/:categoryUuid` didn't exist). `ProductService.listProducts()`
  and `CategoryService` (new `getCategory()`) extended to match.
- **Home page:** "Shop by Category" tiles are now rectangular (matching
  the design's fabric-swatch tiles, not circular) with an arrow, link to
  the new `/category/:categoryUuid` route, and fall back to the
  initial-letter tile on an image load error, not just a missing URL.
  "Shop by Price" is back (dropped since first build, now real via
  `priceMin`/`priceMax`). `ProductCardComponent` gained a matching
  fallback for broken thumbnails, plus a "+ Add to cart" footer link
  (still routes to the `coming-soon` `/cart` page — no cart-mutation
  endpoint is wired into this app yet, see app.routes.ts).
- **Product detail:** thumbnail rail moved to a vertical strip left of
  the main image on ≥768px screens (was a horizontal strip below it at
  every width) to match the design.
- **Responsive bug fix:** the header's hamburger menu only appeared
  ≤767px, but the inline nav hid at ≤1023px — tablets (768–1023px) had
  **no way to reach primary navigation at all**. Both now share the same
  1023px breakpoint. Found via an actual Playwright pass at 375/900/1440px
  against the running dev server (not just a design-image comparison) —
  see this entry's "Verified" note below for the full methodology.
- **Mobile filter drawer bug fix:** `ProductListingComponent`'s mobile
  filter scrim had `display: none` in its base rule and nothing overrode
  it inside the `≤1023px` media query, so the drawer's scrim never
  actually rendered (caught by the same Playwright pass — a scripted
  click on it failed with "element not visible").
- **Security/config fix:** `angular.json` had no `fileReplacements` for
  the environment files in either build configuration, so `environment.ts`
  (holding `http://localhost:4000` with the real HTTPS prod URL commented
  out) was used for *every* build, `ng build --configuration production`
  included. Fixed by wiring `fileReplacements` into the `development`
  configuration and restoring `https://manufestweaves.in/api/v1` (the
  same domain `manufest_admin` already uses live) in `environment.ts`.
  Confirmed by grepping the built JS for both domains under both
  configurations. See `environment.ts`'s header comment.
- **Security hardening:** `index.html` gained a meta-delivered
  Content-Security-Policy and Referrer-Policy — this is the one
  manufest_* frontend a fully anonymous public visitor loads directly, so
  it now carries a stricter baseline than manufest_seller/manufest_admin.
  See `00-overview.md`'s new "Security posture" section and
  `index.html`'s own comment for what the CSP does and doesn't cover
  (clickjacking/report-uri need a real HTTP header from the hosting
  layer, not achievable via `<meta>`).
- **Not done, flagged for a future pass:** `manufest_be` now has
  `cart`/`wishlist`/`customer`/`customer-accounts`/`auth`/`faq` modules
  this app doesn't consume — Login/Register/Account/Cart/Wishlist/FAQ
  still render `coming-soon` despite `ui_design/` now having real designs
  for all of them (`Login Page.png`, `Add cart.png`, four `Profile -
  *.png` files, `FAQ's.png`). Wiring those up is a distinct, larger body
  of work (session/auth flow, cart state, checkout) deliberately kept out
  of this listing-API-driven pass.
- **Verified:** `ng build` (both configurations), `ng test --watch=false`
  all pass clean. Additionally ran the actual app against a live local
  `manufest_be` (real DB, real S3-backed media) via a headless-Chromium
  (Playwright) pass at mobile/tablet/desktop viewports on Home, the new
  listing page, and product detail — screenshotted each, checked
  `document.documentElement.scrollWidth` for horizontal-overflow
  regressions (none found after the two bug fixes above), and exercised
  the hamburger menu and mobile filter drawer interactively rather than
  just eyeballing static widths.

## 2026-09-10 — Product detail opens on the seller's primary image, not just the first one
`manufest_be` added `media.is_primary` (migration `0049`) so a seller can
mark one image per variant as its thumbnail — see that repo's
`.claude/knowledge/02-api-reference.md`/`04-database-schema.md` 2026-09-10
entries, and `manufest_seller`'s own `.claude/knowledge/06-product-catalogue.md`
CHANGELOG entry for the full feature (seller-side UI to pick/change it).
Two changes on this side, both read-only (this app never sets the flag):
`MediaItem` (product.models.ts) gained `isPrimary`; `product-detail.component.ts`'s
`selectVariant()` now opens the gallery on `variant.media.find(m => m.isPrimary)`
instead of always `variant.media[0]`, falling back to `[0]` for a variant
with no primary flagged yet (e.g. videos only). `product-card.component.ts`'s
`thumbnailSrc` needed no change — it already reads the list route's
`thumbnail` field, which the backend now resolves through the same
primary-image logic server-side.

## 2026-09-08 — Initial build
- Scaffolded with `@angular/cli@18` (`ng new --standalone --routing --style=scss`), matching `manufest_seller`/`manufest_admin`'s Angular 18 conventions.
- Home page built live against `GET /public/products/list` and `GET /public/categories/list` — see [01-home-page.md](01-home-page.md).
- Product detail page built live against `GET /public/products/detail/:productUuid`.
- Every other route wired to a shared `coming-soon` placeholder (no backing manufest_be module yet, or explicitly out of scope for this pass) — see `app.routes.ts`.
- `manufest_be` changes made alongside this app (see that repo's own `.claude/knowledge/02-api-reference.md`/`05-config-env.md`/`10-todos-and-stubs.md`, 2026-09-08 entries):
  - New `GET /public/products/media?url=` proxy, backed by a new read-only IAM user (`media_ready_only_user`, `PRODUCT_MEDIA_READONLY_S3_*`) — the "planned read-only IAM user for the public-serving path" that repo's docs had flagged as not-yet-built since 2026-08-19.
  - New `thumbnail` field on `GET /public/products/list` / `/list_by_seller/:sellerUuid` summaries.
- Verified: `ng build` (dev), `ng build --configuration production`, `ng test --watch=false` all pass clean.
- Not verified: an actual end-to-end run against a live `manufest_be` + MySQL/Redis/S3 (none running in the environment this was built in) — the HTTP contracts were built by reading `manufest_be`'s real route source and its own knowledge base, not by hitting a running server. Spot-check the first real run against a live backend before treating the API wiring as fully proven.
