---
generated: 2026-09-08
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

## What's real vs. "coming soon" (as of 2026-09-08, first build)
Only **two** routes call a live `manufest_be` API:
- `''` (Home) — `GET /public/products/list` (Featured Products) +
  `GET /public/categories/list` (Shop by Category).
- `product/:productUuid` (Product Detail) — `GET
  /public/products/detail/:productUuid`.

Every other route (`login`, `register`, `account`, `cart`, `wishlist`,
`notifications`, `search`, `new-arrivals`, `origin`, `fabric`, `weave`,
`occasion`, footer links, wildcard `**`) renders the shared
`shared/coming-soon/coming-soon.component` — see `app.routes.ts`'s own
header comment for why (no corresponding manufest_be module exists yet for
any of them: no cart/orders/wishlist/notifications/reviews module, and a
full filtered product-browsing page was explicitly out of scope for this
pass per the user's own instruction). Adding real functionality later is
additive — swap one route's `loadComponent`, nothing else changes.

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
`manufest_seller/design-reference/user/**` (a sibling repo, not duplicated
into this one) — `home/*.png` (desktop/tablet/iphone) is what the Home page
was built against; `faq/`, `sort-by/`, `view-all/` correspond to
"coming soon" destinations in this app (no page built from them yet). The
same Figma file `manufest_seller` documents
(`.claude/knowledge/05-figma-mcp-setup.md`, fileId
`XkS8nmiidHb62wLJ74lo4e`, `style-guide` page node `9:50` for global colors)
applies here too — colors/spacing tokens in `src/styles.scss` are copied
from that file's already-confirmed values, not re-derived, to avoid
burning the same Figma API rate limit `manufest_seller`'s docs warn about.

## Build / verify
```
npm install
ng build            # dev config
ng build --configuration production   # or: npm run pbuild
ng test --watch=false
```
All three passed clean as of this build (see CHANGELOG.md).
