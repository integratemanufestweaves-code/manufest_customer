# manufest_customer — Remaining Work

Generated 2026-09-12. Cross-referenced against:
- `ui_design/*.png` (Figma exports — Home, Login, Add cart/checkout, Sort by,
  View all, FAQ's, Profile - Account/Messages/Orders/Wishlist/Sell on manufest)
- `manufest_be/.claude/knowledge/02-api-reference.md` and
  `10-todos-and-stubs.md` (actual backend routes as of 2026-09-10)
- This app's current `app.routes.ts` (four real routes today: Home,
  Product Detail, New Arrivals, Category — everything else renders the
  shared `ComingSoonComponent`)

Each item below is tagged:
- **[BE ready]** — `manufest_be` already has a working API for this; it's
  pure frontend work.
- **[BE partial]** — an API exists but doesn't cover everything the design
  shows; frontend work now, backend follow-up later.
- **[BE missing]** — no backend module/table for this at all. Frontend
  work is blocked until `manufest_be` builds it.

**2026-09-12 update:** §1 (Auth), §2 (Cart), §3 (Wishlist), §4a/§4b (Profile
+ Manage Address tabs), and §9 (FAQ) are now built — see
`AuthService`/`CartService`/`WishlistService`/`CustomerService`/`FaqService`
in `core/services/`, `customerAuthGuard` in `core/guards/`, and the
`features/auth/`, `features/cart/`, `features/wishlist/`, `features/account/`,
`features/faq/` components. Product card + product detail now do real
add-to-cart/wishlist-toggle instead of routing to "coming soon". Everything
else below (§4c/§4d, §5 attribute filters, §6 search, §7 checkout, §8 order
history, §10 Origin/Weave, §11) is still open, most of it genuinely blocked
on backend work rather than unbuilt frontend.

---

## 1. Auth (Login / Register / Session) — [BE ready]

Figma (`Login Page.png`) shows an identifier-first flow inside a modal, not
a dedicated page: enter email/mobile → app detects new vs. existing →
existing user enters password (or a "Sign in with Passkey" option) →
new user goes through a create-account form (mobile + OTP + first name +
password).

Backend (`auth.api.js`, mounted `/api/v1/auth/customer`) supports:
- `POST /register`, `POST /login` (email+password)
- `POST /register/mobile`, `POST /register/mobile/verify-otp` (mobile+OTP
  signup, doubles as a "resume" flow if the number already exists)
- `POST /login/otp/request`, `POST /login/otp/verify` (mobile+OTP login)
- `POST /otp/resend`
- `POST /refresh`, `POST /logout`, `GET /me`, `GET /sessions`
- `POST /password/change`, `POST /password/reset/request` /
  `/reset/confirm` — **note: reset email is never actually sent** (backend
  stub, see §4) — the reset link/flow has nowhere to land for a real user
  yet, so build this screen last or behind a "contact support" fallback.

**Not backed:** Passkey/WebAuthn — no such concept exists anywhere in
`manufest_be`. Drop it from v1, or flag to backend as a new ask.

**To build:**
- Replace `login`/`register` routes' `ComingSoonComponent` with a real
  `AuthService` (cookie-based session, matches `credentials.interceptor.ts`
  already wired in `core/interceptors/`) + the modal/flow above.
- Wire header's Profile icon to actual signed-in state (name, avatar) vs.
  "Sign in" when logged out.
- Route guard for anything requiring `authenticateCustomer` (cart,
  wishlist, account, checkout).
- CSRF token fetch (`GET /csrf`) before any state-changing call, per the
  existing interceptor's expectations.

---

## 2. Cart — [BE ready]

Figma: "Add to cart" already wired on every product card/detail page
(currently routes to the coming-soon cart page per `product-card`'s own
header comment). No dedicated "cart drawer" screen was found in the
design set — the cart's contents surface directly inside the checkout
modal's Review step (see §7).

Backend (`cart.api.js`, `/api/v1/customer/cart`):
- `GET /` — items + live total; each item has both `priceAtAdd` (snapshot)
  and `currentPrice` (resolved fresh) — **build a "price changed since you
  added this" indicator**, the API is shaped specifically for it.
- `POST /items` `{variantUuid, quantity?}` — upsert (adding again
  increments qty), 409s `INSUFFICIENT_STOCK` if over available stock.
- `PUT /items/:cartItemUuid` — set exact quantity (not a delta).
- `DELETE /items/:cartItemUuid`, `DELETE /` (clear all).

**To build:**
- `CartService` + cart page/drawer: line items, qty stepper, remove,
  subtotal, stock-exceeded error surfacing (409 → inline message, not a
  generic toast).
- Wire real "Add to cart" from product card + product detail (currently
  dead links to coming-soon).
- Cart item count badge in header (currently static icon, no count).
- Handle: cart is **variant-level** — product detail must resolve a
  specific variant (color/size) before "Add to cart" is enabled, not just
  the product.

---

## 3. Wishlist — [BE ready]

Figma (`Profile - Wishlist.png`): grid of saved products, each with a
remove (×) button and "Move to cart" button, plus a "You may like it"
recommendation row. Header shows a live count badge (`Wishlist(12)`).

Backend (`wishlist.api.js`, `/api/v1/customer/wishlist`):
- `GET /` — items with name/sku/price range.
- `POST /items` `{productUuid}` — idempotent (re-adding is a silent no-op).
- `DELETE /items/:wishlistItemUuid`.

**Not backed:** wishlist is **product-level**, not variant-level — "Move
to cart" needs the frontend to prompt for a variant (or default to the
first/only one) before calling `POST /customer/cart/items`, since the
wishlist API itself has no variant concept.

**To build:**
- `WishlistService` + wishlist page (grid, remove, move-to-cart).
- Heart/wishlist toggle icon on product card + detail (add/remove,
  reflect current state).
- Header wishlist count badge.
- "You may like it" row can reuse the existing product-list query
  (e.g. same category) — no dedicated recommendations endpoint exists.

---

## 4. Customer Profile / Account — [BE ready, partial]

Figma (`Profile - Account.png`) shows a tabbed Account page: **Profile |
Manage Address | Manage Payment details | Purchase and Reviews**, plus a
header dropdown (Orders / Wishlist / Messages / Sell on manufest / Account
/ Sign out).

### 4a. Profile tab — [BE ready]
`PATCH /api/v1/customer/profile` (firstName/lastName/dob/phone),
`PATCH /api/v1/customer/profile/photo` (base64 upload, "skipped" degrade if
storage isn't configured — surface that gracefully, not as an error).
`GET /api/v1/auth/customer/me` for the initial load.

### 4b. Manage Address tab — [BE ready]
Full CRUD already exists: `GET/POST/PUT/DELETE
/api/v1/customer/addresses`, with `isDefault` handling (setting one clears
other defaults) baked into the API.

### 4c. Manage Payment details tab — [BE missing]
No saved-card/UPI-method storage exists in `manufest_be` at all. The only
adjacent table is `customer_accounts` (`GET/PUT
/api/v1/customer/bank-account`), which is for **refund payout details**,
not a saved checkout payment method. Either scope this tab down to "bank
details for refunds" (rename to match what's actually backed) or flag to
backend as a new ask before building it as designed.

### 4d. Purchase and Reviews tab — [BE missing]
No reviews/ratings module exists anywhere in the schema. See §8.

**To build:**
- `CustomerService` (profile GET/PATCH, photo upload).
- `AddressService` (CRUD) + address book UI (list, add/edit modal, set
  default, delete).
- Profile tab, Manage Address tab. Defer/rescope Payment details and
  Purchase-and-Reviews tabs per the gaps above.
- Header profile dropdown menu (Orders/Wishlist/Messages/Sell on
  manufest/Account/Sign out) — currently no such menu exists.

---

## 5. Product Listing Filters — [BE partial]

Already live: `ProductListingComponent` (New Arrivals + Category pages),
backed by `GET /public/products/list` with `categoryUuid`, `occasionUuid`,
`priceMin`/`priceMax`, `sort` (`newest`/`oldest`).

Figma's filter sidebar (`Sort by.png`, `Add cart.png`, `View all.png`)
shows a much richer set: **Brand, Price (range slider), Colors, Discount
Range, Blouse (with/without piece, stitched/ready, fabric match), Fabric
Purity, Material, Zari Colour, Zari Type, Border Type, Occasion.**

Of these, the backend's `product_attributes_master` taxonomy actually
models: `material`, `fabric_purity`, `occasion`, `color`, `zari_type`,
`zari_color`, `border_type` — but **only `occasionUuid` is exposed as a
public list filter today**. The rest of these attributes exist in the
data model but have no query param to filter by them.

**Not backed at all:** `brand` (no such concept anywhere in the schema —
likely means "seller", which the product list doesn't filter by either),
discount-percentage filtering, a price *range slider* (only min/max
numeric bounds exist — fine for a slider UI, just confirming the numbers
match).

**To build (frontend, once backend adds the params):**
- Extend the existing filter sidebar with Material/Color/Zari
  Type/Zari Colour/Border Type/Fabric Purity checkboxes — **blocked on
  backend** adding `materialUuid`/`colorUuid`/`zariTypeUuid`/
  `zariColorUuid`/`borderTypeUuid` query params (same `EXISTS`-subquery
  pattern already used for `occasionUuid`, per `02-api-reference.md`).
- Price range as a dual slider (frontend-only change, params already
  exist).
- Drop "Brand"/discount-range filters from the UI, or ask backend whether
  either has a real backing concept intended.

---

## 6. Search — [BE missing]

Header search bar exists but routes to `search` → coming-soon. No
full-text/keyword search endpoint exists for products anywhere in
`manufest_be` — `GET /public/products/list` has no `q`/`search` param
(only structured filters). The only text search that exists at all is
FAQ's plain `LIKE` match on `question` (see §9).

**To build:** blocked on backend adding a search param (or dedicated
search endpoint) to the products list. Until then, this route has nothing
real to wire up.

---

## 7. Checkout / Place Order — [BE missing] — **CRITICAL GAP**

This is the single biggest gap in the whole app, and the design has
clearly spent the most effort here — worth calling out on its own.

Figma (`Add cart.png`, right-hand frames) shows a full 3-step checkout
modal:
1. **Delivery** — select/add a shipping address (reuses the address book
   from §4b).
2. **Payment** — choose method: Credit/Debit card (card number, name,
   expiry, CVV), UPI, Cash on Delivery, Net Banking (bank select), "Scan
   and Pay with UPI".
3. **Review** — order summary card: delivery address with default badge,
   payment method summary, line items with delivery estimate, a "please
   record a video while opening the parcel" note, price breakdown
   (item total / shop discount / tax / delivery / order total), "Pay Now".
4. A "Payment processing" loading state, presumably followed by an order
   confirmation (not captured in the design set, but implied).

**Backend reality:** `orders` and `order_seller_groups` tables exist as
**schema-only groundwork** (migration 0048) — explicitly documented as "no
module/routes at all" in `10-todos-and-stubs.md`. `order_items` and
`payments` tables **don't exist yet either**. There is no
`POST /checkout` or `POST /orders` endpoint anywhere. Cart's own stock
check is "not a real reservation" — nothing holds stock during checkout.

**This means:** a customer can browse, filter, add to cart, and wishlist
— but can never actually complete a purchase today. **This is the top
priority to raise with the `manufest_be` team**, since no amount of
frontend work can substitute for it. Needs, at minimum:
- `order_items` table + a real "place order" endpoint.
- A `payments` table/module, or a payment-gateway integration (Razorpay is
  already used elsewhere in this codebase for IFSC lookups — likely the
  natural choice, but that's a backend decision).
- A real stock reservation step (the TODO doc explicitly flags cart's
  stock check needs replacing with real reservation logic "once the
  orders module exists").
- Order confirmation email (ties into §4, email sending is also a stub
  today — see §11).

Frontend work here is entirely blocked until that exists. Don't start
building the checkout UI against real endpoints until backend confirms a
contract — mocking it now would mean re-doing the integration layer once
real endpoints land.

---

## 8. Order History / Tracking / Returns — [BE missing]

Figma (`Profile - Orders.png`) shows a very complete post-purchase flow:
filter by status (On the way/Delivered/Cancelled/Returned) and time range,
search by order, per-order status badges (Confirmed/Cancelled/Delivered/
Returned/Partially Delivered), invoice download, and per-item actions
depending on status (Track Package, Cancel, Buy Now, Replacement, Return,
Buy Again, Rate this product).

**Backend reality:** same as §7 — no `orders` module/routes exist at all.
Everything here (tracking, invoices, replacement/return workflows,
"rate this product") is blocked on the orders module existing first, and
several sub-features (replacement/return processing, invoice generation)
aren't even implied by the current schema-only `orders`/
`order_seller_groups` tables — they'd need their own design once orders
exist.

---

## 9. FAQ — [BE ready]

Figma (`FAQ's.png`): sidebar categories (Shipping & Delivery, Ordering &
Shopping, Returns/Refunds & Protection, Product Quality & Authenticity,
Manufacturers & Sellers) + a search box + an accordion list of Q&A pairs.

Backend (`faq.api.js`, `/api/v1/public/faq/*`):
- `GET /categories` — active categories, sorted.
- `GET /list?categoryUuid=&q=` — both optional/combinable; `q` is a plain
  `LIKE` against `question`.

**To build:** this one's fully backed and straightforward — sidebar +
accordion + search, replacing the `faq` route's `ComingSoonComponent`.
Map each category to an icon client-side (design shows one per category;
no icon field exists on the API, purely a frontend presentation choice).

---

## 10. Origin / Fabric / Weave Nav — [BE missing for Origin & Weave]

Header nav has `New Arrivals | Origin | Fabric | Weave | Occasion`.
`Occasion` can already reuse `ProductListingComponent` with
`occasionUuid` (same pattern as Category) — **that one's buildable now**.

`product_attributes_master.attribute_type` only ever contains: `material`,
`fabric_purity`, `occasion`, `color`, `zari_type`, `zari_color`,
`border_type` — confirmed directly from the schema doc. **There is no
`origin` or `weave` attribute type anywhere in the database.** `Fabric`
could reasonably map to the existing `material` attribute (once §5's
`materialUuid` filter param exists) — but `Origin` (e.g. browsing by
weaving region like Kanchipuram/Banarasi) and `Weave` (weaving technique)
have no backing concept to browse by at all today.

**To build:**
- `occasion` route → live now, same pattern as `category/:categoryUuid`.
- `fabric` route → live once §5's material filter param ships.
- `origin` / `weave` → blocked; would need new `attribute_type` values (or
  an entirely new taxonomy concept) added to the schema first. Worth
  asking the user/backend team whether "Origin" is meant to map to
  something that already exists under a different name (e.g. seller's
  region) before treating it as net-new schema work.

---

## 11. Other mandatory e-commerce basics not covered above

Flagging these since they're commonly assumed "of course we have that"
gaps that didn't show up in the module-by-module walkthrough above:

- **Transactional email is entirely stubbed** — `email.worker.js` only
  logs, never sends via a real provider (SES/Postmark/SendGrid). This
  affects password reset (§1), and will affect order confirmation once
  orders exist (§7). Not a frontend problem, but every "check your email"
  UI moment in the design won't actually deliver anything until this is
  wired up.
- **No coupon/promo-code system** — removed along with the old
  payments/checkout modules; nothing in the current schema models a
  discount code, despite "Shop discount" appearing as a line item in the
  checkout Review step design.
- **No customer-facing notifications** — only *admin* notifications exist
  (seller-registration events). The header's notification icon and the
  Profile "Messages/Notifications" screen (`Profile - Messages.png`) have
  nothing to read from.
- **No customer messaging/support-chat backend** — `Profile - Messages.png`
  shows a message-thread list; no such table/module exists (`support`
  module is staff-facing internal notes, not customer-visible chat).
- **CAPTCHA is flagged but unwired** — env vars exist, no provider
  actually configured. Low risk today (no public forms besides
  register/login, which already have rate-limiting + lockout), but worth
  knowing before assuming bot protection exists anywhere.
- **No product reviews/ratings module at all** — explains why the current
  product cards show no stars/review count (already documented in this
  app's own `01-home-page.md`), and blocks the Account page's "Purchase
  and Reviews" tab and the Orders page's "Rate this product" action.
  Given how prominently ratings appear throughout the Figma set (product
  cards, filters sidebar has no rating filter but cards show 4.6★ etc.),
  this is worth raising alongside the orders gap as a second
  backend-priority ask.

---

## Suggested priority order

1. **Auth** (§1) — nothing else below can be "signed in" without it.
2. **Cart** (§2) + **Wishlist** (§3) — both fully backed, high visible
   value, no backend blockers.
3. **Address book** (§4b) — backed, and a prerequisite for checkout later.
4. **FAQ** (§9) — backed, low effort, currently 100% coming-soon for no
   reason.
5. **Profile tab** (§4a) — backed, moderate effort.
6. **Occasion browse page** (§10) — backed, same pattern as Category.
7. Flag to `manufest_be`: **checkout/orders/payments** (§7) and
   **reviews/ratings** — these block the highest-value remaining screens
   (Orders history, Review-and-rate, real purchases) and are pure backend
   work; frontend should not start building against guessed contracts.
8. Once backend responds: Checkout flow (§7), Order history (§8).
9. Lower priority / needs product-decision input: saved payment methods
   (§4c), search (§6), Origin/Weave/Fabric browse (§10), coupons/
   notifications/messaging (§11).
