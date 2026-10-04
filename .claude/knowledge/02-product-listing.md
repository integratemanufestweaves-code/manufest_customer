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

## Price filter UX (updated 2026-10-05)
A single-select radio group (click the selected one again to clear it) of
four bands, defined once as `PRICE_BANDS` in
`core/models/product-filters.models.ts` and shared with the header's
"New Arrivals → Shop by Price" menu:

| Label | Query params |
|---|---|
| Under ₹299 | `priceMax=299` |
| Under ₹1,000 | `priceMax=1000` |
| Under ₹2,000 | `priceMax=2000` |
| ₹3,000 and above | `priceMin=3000` |

- Both bounds are **inclusive** server-side (`selling_price <= priceMax` /
  `>= priceMin`), so "Under ₹299" includes a product at exactly ₹299.
- **Known gap (user-chosen bands):** products priced above ₹2,000 and below
  ₹3,000 match no band; they only appear with no price filter. The user was
  told and offered a ₹2,000–₹3,000 band; not added unless asked.
- A product matches if **any** of its variants is in range, while its card
  shows only the cheapest variant's price (see `product-card`), so a card can
  show a price outside the selected band.
- The active-filter chip uses `priceRangeLabel()` ("Under ₹299", "₹3,000 and
  above", or "₹500 - ₹1,000" for a hand-typed two-sided URL).
- Home's "Shop by Price" tiles (`home.component.ts`'s `priceBands`, Under
  ₹5,000 … ₹50,000–1,00,000) are a **separate, older list** and were not
  changed; landing from one shows no selected radio in the sidebar.
- The earlier preset buttons and free-form Min/Max inputs no longer exist.

## Origin filter hidden (2026-10-05)
The Origin (seller district) facet is left out of the sidebar's facet list
in `sections` (see the comment there), and the header's Origin menu is
commented out in `header.component.ts`'s `navLinks`. Both are one-line
restores. `?origin=` URLs still filter; they just show no sidebar group.
A "Tenkasi, TN" district+state label was built and then fully reverted at
the user's request (no `state` column exists on `seller_registration`).

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
