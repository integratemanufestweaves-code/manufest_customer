---
generated: 2026-09-10
purpose: What backs the product-listing/browse page, and exactly which parts of ui_design/Sort by.png and ui_design/View all.png were and weren't implemented, and why.
---

# Product listing — `features/product-listing/product-listing.component.*`

Added 2026-09-10 against `manufest_be`'s same-day change to `GET
/public/products/list` (`applyPublicListFilters()` in
`products.api.js` — see that repo's `.claude/knowledge/02-api-reference.md`
"Filterable public listing" entry): 5 new optional, AND-combinable query
params — `categoryUuid`, `occasionUuid`, `priceMin`, `priceMax`, `sort`
(`'newest'` default | `'oldest'`).

Serves two routes (`app.routes.ts`), same component both times:
- `new-arrivals` — no category pinned. "New Arrivals" is itself just
  `sort=newest`, the API's own default (per that same `manufest_be` doc
  entry: "new arrivals is a sort order, not a separate time-windowed
  filter").
- `category/:categoryUuid` — Home's "Shop by Category" tiles land here.

## What matches `ui_design/Sort by.png` / `ui_design/View all.png`
Breadcrumb, a sort control, a filters sidebar (off-canvas drawer on
screens ≤1023px, toggled by a "Filters" button, with a scrim), a product
grid reusing `ProductCardComponent`, and cursor-based "Load more" (the
design's mockup doesn't show pagination at all, but the API is
cursor-paginated — `hasMore`/`nextCursor`).

## What's deliberately different from the mock, and why
The design shows a much richer filter sidebar: Brand(Seller), Price,
Colors, Discount Range, Blouse, Fabric Purity, Material, Zari Colour, Zari
Type, Border Type, Occasion — each a checkbox list — plus a "Sort by"
dropdown with Popularity / Price: Low to High / Price: High to Low /
Better Discount / Newest.

Only **Price** (as `priceMin`/`priceMax`) and **Sort** (as `newest`/
`oldest`) are implemented as real, working controls. Everything else is
left out entirely — not disabled, not stubbed with a "coming soon" toast
— because:

- `applyPublicListFilters()` doesn't accept a brand/seller, color,
  discount-percent, blouse, fabric-purity, material, zari-colour,
  zari-type, or border-type filter at all. Building checkboxes for
  filters the API can't apply would be fake UI, not a coming-soon page.
- Even where the *product model* carries some of these as attributes
  (`ProductDetail.attributes.material`/`fabricPurity`/`zariType`/
  `zariColor`/`borderType`/`colorHex` — see `product.models.ts`), there is
  no public endpoint that lists the *distinct available values* to build
  a checkbox list from in the first place (`/seller/products/
  attributes-master` and `/admin/products/attributes-master` both require
  seller/admin auth — see `manufest_be`'s api-reference).
- `occasionUuid` **is** a real, working query param
  (`ProductService.listProducts()` accepts it), but no UI calls it with a
  value yet for the same reason — nothing publicly lists occasion values
  to pick from. It's there for forward-compatibility, not currently wired
  to a control.
- "Popularity" and "Better Discount" sort aren't real orderings the API
  supports (`sort` is a strict `'newest' | 'oldest'` enum, 422s on
  anything else) — `manufest_be`'s own doc entry calls out
  popularity/`view_count`-based sort as "not built (deliberately out of
  scope, not an oversight)". "Price: Low to High"/"Price: High to Low"
  aren't sort orders either on this API — they'd need a real
  `sort=price_asc` server-side implementation that doesn't exist; the
  *price filter* (min/max) is real and is what's implemented instead.

Same documentation discipline `home.component.ts`'s header comment and
`product-card.component.ts`'s header comment already use for their own
API-driven deviations from the design.

## Price filter UX
Two ways to set `priceMin`/`priceMax`, both writing the same query params:
1. Six fixed preset buttons (Under ₹5,000 / ₹5,000–10,000 / … /
   ₹50,000–1,00,000) — same six bands as Home's "Shop by Price" tiles
   (`home.component.ts`'s `priceBands`), so a Home tile click and the
   listing page's own preset selection land on the exact same state.
2. Free-form Min/Max number inputs with an "Apply" button — validated
   client-side (non-negative, `min <= max`) before being written to the
   URL, mirroring the same `priceMin <= priceMax` `refine()` the backend's
   Zod schema enforces (`products.validation.js`) so a request that would
   422 never gets sent.

Filter/sort state lives in the URL (`router.navigate` with
`queryParamsHandling: 'merge'`), not just component state — bookmarkable,
shareable, and back-button-safe, same reasoning as any filterable listing
page.

## Category breadcrumb name
`CategoryService.getCategory(categoryUuid)` — new method, `GET
/public/categories/list_by_id/:categoryUuid` — resolves the category's
display name for the page heading/breadcrumb when arriving via
`/category/:categoryUuid`. Falls back to `null` (heading shows "New
Arrivals") on any error rather than blocking the product grid on it.
