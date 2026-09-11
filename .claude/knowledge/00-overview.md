---
generated: 2026-09-08
updated: 2026-09-10
purpose: Entry point for Claude's knowledge base of this repo. Read this first.
---

# manufest_customer — overview

Angular 18 standalone-component app: the **customer-facing storefront** for
Manufest — the third frontend alongside `manufest_seller` (seller
onboarding/dashboard) and `manufest_admin`, all talking to the same
`manufest_be` backend (sibling directories, same as `manufest_seller`
documents its own relationship to `manufest_be`).

## Stack / conventions
Same conventions as `manufest_seller` — Angular 18, standalone components,
signals for local state, `loadComponent` lazy routes, SCSS. No NgModules.
`core/interceptors/credentials.interceptor.ts` is copied from
`manufest_seller`'s (same `withCredentials`/CSRF-header-by-hand rationale —
see that file's header comment) even though nothing in this app calls an
authenticated route yet, so the security convention is already correct the
moment customer auth/cart/wishlist land on real routes.

`shared/header/`'s mobile off-canvas nav drawer (2026-09-10) is a
deliberate visual port of `manufest_seller/layout/{sidebar,seller-shell,
topbar}.component.*`'s mobile pattern — same fixed-drawer + backdrop +
`translateX` mechanics, applied to this app's top-nav header instead of a
persistent sidebar. There's no shared component library between the
manufest_* apps, so this is copied-and-adapted, not imported — worth
checking that sibling app's `layout/` folder before building a new
responsive UI pattern here, since a validated one may already exist there.

## What's real vs. "coming soon" (updated 2026-09-10)
**Four** routes call a live `manufest_be` API:
- `''` (Home) — `GET /public/products/list` (Featured Products) +
  `GET /public/categories/list` (Shop by Category).
- `product/:productUuid` (Product Detail) — `GET
  /public/products/detail/:productUuid`.
- `new-arrivals` and `category/:categoryUuid` (both
  `ProductListingComponent`, added 2026-09-10) — `GET
  /public/products/list` using the `categoryUuid`/`priceMin`/`priceMax`/
  `sort` filters `manufest_be` added the same day. See
  [02-product-listing.md](02-product-listing.md).

Every other route (`login`, `register`, `account`, `cart`, `wishlist`,
`notifications`, `search`, `origin`, `fabric`, `weave`, `occasion`, footer
links, wildcard `**`) still renders the shared
`shared/coming-soon/coming-soon.component` — see `app.routes.ts`'s own
header comment for why (no corresponding manufest_be module wired into
this app yet for any of them). Adding real functionality later is
additive — swap one route's `loadComponent`, nothing else changes.

**Note:** `manufest_be` has since grown `cart`/`wishlist`/`customer`/
`customer-accounts`/`auth`/`faq` modules (confirmed present under
`manufest_be/src/modules/` as of 2026-09-10) that this app doesn't consume
yet. Wiring those up — session/auth flow, cart state, checkout — is a
separate, larger pass than the listing-API-driven change this entry
documents; flagged here so the next pass doesn't have to rediscover that
those modules already exist.

See [01-home-page.md](01-home-page.md) for the Home page's section-by-section
breakdown (what's live, what's static, and — importantly — what from the
design mock was deliberately *not* implemented and why).

## Media — the read-only IAM user
Product photos/videos live in a **private** S3 bucket
(`manufest-media-storage`) on the `manufest_be` side — raw URLs 403 if
loaded directly. This app never talks to S3 directly and holds no AWS
credentials at all; it always resolves a media `url` through
`ProductService.mediaSrc()`, which rewrites it to `GET
/public/products/media?url=` on `manufest_be`. That route (added
2026-09-08 alongside this app) is backed by a **new, separate, read-only**
IAM user (`media_ready_only_user`, `PRODUCT_MEDIA_READONLY_S3_*` env block)
— see `manufest_be/.claude/knowledge/05-config-env.md`'s 2026-09-08 entry
and `src/modules/media/storage/productMediaReadOnlyStorage.adapter.js`.
This was exactly the "separate, dedicated read-only IAM user...planned for
whatever service ends up serving these publicly to customers" that
`manufest_be`'s own docs had flagged as not-yet-built when the
seller-catalogue product-media bucket was first set up (2026-08-19) — this
app is that planned consumer.

## Design reference
As of 2026-09-10, the primary design source is this repo's own
`ui_design/` folder (checked in directly, unlike the sibling-repo
reference below) — one flattened multi-frame PNG per screen, covering
Home, Login, Add cart, FAQ's, Sort by, View all, and four Profile screens
(Account/Messages/Orders/Sell on manufest/Wishlist). Each PNG bundles
several breakpoints (desktop/tablet/iphone, sometimes an interaction
state like a dropdown open) side by side on one canvas — crop before
reading closely; `python3 -c "from PIL import Image; ..."` was used to
crop specific regions during the 2026-09-10 pass rather than guessing
coordinates from the thumbnail. This set is considerably more complete
than what existed before (it's the first design reference at all for
Login/Profile/Cart — those routes still render `coming-soon` because
there's no backend module wired in yet, not because there's no design).

`manufest_seller/design-reference/user/**` (a sibling repo, not duplicated
into this one) is the **older** reference — `home/*.png`
(desktop/tablet/iphone) is what the original 2026-09-08 Home page build
used; `faq/`, `sort-by/`, `view-all/` there predate and correspond to the
same-named screens now in `ui_design/`. Kept for history; prefer
`ui_design/` for anything new since it's versioned alongside this app
rather than borrowed from a sibling's folder.

The same Figma file `manufest_seller` documents
(`.claude/knowledge/05-figma-mcp-setup.md`, fileId
`XkS8nmiidHb62wLJ74lo4e`, `style-guide` page node `9:50` for global colors)
applies here too — colors/spacing tokens in `src/styles.scss` are copied
from that file's already-confirmed values, not re-derived, to avoid
burning the same Figma API rate limit `manufest_seller`'s docs warn about.

## Build / verify
```
npm install
ng build --configuration development   # local dev build, environment.development.ts (localhost:4000)
ng build                                # production config is the default — see note below
ng test --watch=false
```
All three pass clean as of this build (see CHANGELOG.md).

**2026-09-10 environment/security fix:** `angular.json`'s `build`
architect target had `defaultConfiguration: "production"` but *no*
`fileReplacements` in either configuration — so `environment.ts` was used
for every build, `ng serve` included, and it held `http://localhost:4000`
with the real HTTPS URL commented out. A `ng build`/`ng build
--configuration production` would have shipped an unreachable, plain-HTTP
API URL to real users. Fixed by adding `fileReplacements` to the
`development` configuration (swapping in `environment.development.ts`)
and restoring the real `https://manufestweaves.in/api/v1` in
`environment.ts` — confirmed by grepping the built JS for both domains
after each configuration. See `environment.ts`'s own header comment. This
app is the one manufest_* frontend a fully unauthenticated public visitor
loads directly, so this class of bug (shipping the wrong origin, or a
plain-HTTP one) matters more here than it would for manufest_seller/
manufest_admin — see the "Security posture" section below.

## Security posture
This is the one manufest_* frontend reachable by an anonymous member of
the public with no login step at all — manufest_seller/manufest_admin are
both staff/seller-only surfaces. Treat its client-side security bar as
strictly higher:
- `src/index.html` carries a meta-delivered `Content-Security-Policy`
  (`default-src 'self'`, no `unsafe-eval`, `object-src 'none'`) and a
  `Referrer-Policy` (added 2026-09-10) — see that file's own comment for
  what it does and doesn't cover (clickjacking protection via
  `frame-ancestors`/`X-Frame-Options` and CSP violation reporting both
  require a real HTTP header from the hosting layer, not achievable via
  `<meta>`).
- `core/interceptors/credentials.interceptor.ts` already carries the same
  cookie-auth + CSRF double-submit pattern `manufest_seller` uses, wired
  in from day one so it doesn't need to change when customer auth lands.
- No `innerHTML`/`bypassSecurityTrust*` anywhere in this app — every
  binding goes through Angular's normal interpolation/property binding,
  which auto-escapes.
- When customer auth/cart/checkout eventually land here, hold this app to
  at least the same bar manufest_be's own `12-identity-split.md` documents
  for cookie/session handling — and go further where the extra exposure
  warrants it (e.g. stricter rate-limiting expectations on
  login/register than an internal seller-onboarding form would need,
  since this surface is open to arbitrary internet traffic, not just
  vetted sellers/staff).
