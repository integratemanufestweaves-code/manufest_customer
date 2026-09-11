---
generated: 2026-09-08
updated: 2026-09-10
purpose: Section-by-section breakdown of the Home page — what's live, what's static, and what was deliberately left out of the design mock and why.
---

# Home page — `features/home/home.component.*`

Built against `manufest_seller/design-reference/user/home/home-01-desktop.png`
/ `-02-desktop.png` (desktop), `-05-tablet.png` (tablet), `-06-iphone.png` /
`-07-iphone.png` (mobile). `home-03-desktop.png`/`home-04-desktop.png` in
that same folder are actually the "New Arrivals" filtered-listing screen,
not Home — not used here (that page is out of scope, see below).

| Section | Status | Notes |
|---|---|---|
| Announcement bar | Static | Policy copy ("free shipping over ₹2,999"), not a factual claim tied to real data. |
| Header (logo/nav/search/wishlist/cart/account) | Static shell | `shared/header/`. Every link except the logo routes to "coming soon" — see `app.routes.ts`. |
| Hero banner ("Special offer") | Static | Generic seasonal creative, not tied to a real promotions API (none exists). |
| Trust badges (4 items) | Static | Value-prop copy, not data. |
| **Featured Products** | **Live** | `ProductService.listProducts({limit: 10})` → `GET /public/products/list`. Loading skeleton / error / empty states all handled. "View all" → `/new-arrivals`. |
| **Shop by Category** | **Live** | `CategoryService.listCategories()` → `GET /public/categories/list`. Rectangular tile (not circular — fixed 2026-09-10 to match the design's fabric-swatch tiles) with an arrow next to the label. Falls back to an initial-letter tile when a category has no `image_url`, **or when that `image_url` fails to load** (`(error)` handler added 2026-09-10 — placeholder/seed `image_url` values that don't resolve, e.g. `cdn.example.com`, used to render a broken-image icon). Each tile links to `/category/:categoryUuid` (`ProductListingComponent`). |
| **Shop by Price** | **Live (added 2026-09-10)** | Fixed six price-band tiles (Under ₹5,000 through ₹50,000–1,00,000, `home.component.ts`'s `priceBands`) linking into `/new-arrivals?priceMin=&priceMax=` — real filters as of `manufest_be`'s same-day change. Unlike the two sections above there's no list to fetch (the bands are a UI convention, not data), so this is plain static markup, no loading state. Tiles are a flat gradient card with the band label + arrow rather than photography — the design shows a model photo per band, but there's no per-band image asset or API to source one from, and picking an arbitrary product photo to represent "10k–20k" would imply a specific product defines that price band, which isn't true. |
| **Shop by Occasion** | **Static (added 2026-09-10, later same day)** | Fixed tiles (Daily Wear, Office/Work Wear, Casual Outing, Festival Wear, Wedding/Bridal, Party Wear — same vocabulary as `ProductAttributes.occasions`/the design's filter sidebar), not fetched. There's still no public endpoint that lists occasion *values* (see `02-product-listing.md`), so tiles link to plain `/new-arrivals` rather than a specific `occasionUuid`. Added at the user's explicit direction to match `ui_design/Home Page.png` pixel-for-pixel — supersedes this file's earlier "dropped" decision for this section. |
| **Manufacturer spotlight / stat counters / Grow-your-business / customer reviews** | **Static placeholder content (added 2026-09-10, later same day, user-directed)** | Previously dropped entirely because no reviews/testimonials/manufacturer-profile module exists in `manufest_be` (see this file's original 2026-09-08 reasoning, now superseded). The user explicitly asked for pixel parity with `ui_design/Home Page.png` including this content, with photo slots as swappable placeholders. **Still flagged in `home.component.ts`'s header comment**: shipping named reviewer quotes + 5-star ratings as if real is an FTC-style endorsement-disclosure risk — replace with real review data (or label as sample) before public launch. Photo slots use the shared `.ph-image` placeholder (an icon over a flat brand-toned background) rather than a fabricated photo — swap each for a real `<img>` once assets exist (four slots: hero banner, manufacturer photo, grow-business photo, review avatars). |
| Manufacturer spotlight quote ("Annapoorna Handloom Works... — Sai Kumar") | **Not implemented as shown** | The design hardcodes a specific named manufacturer + a quoted person. No manufacturer-profile/testimonial module exists in `manufest_be` — inventing a specific business name and a quote attributed to a named person would be fabricated content presented as real, not a "coming soon" gap. Replaced with an honest static teaser (`.stories` section) that says real manufacturer/review content is planned, without inventing any of it. |
| Stat counters ("8,000+ Happy Customers", "600+ Handcrafted Designs", etc.) | **Dropped** | Same reasoning — these are specific fabricated numbers with no backing data source. Not rendered at all rather than shown with made-up figures. |
| "Trusted by customers" reviews (named reviewer, 5-star ratings, repeated photo) | **Dropped** | Same reasoning, and no reviews module exists in `manufest_be` to eventually back it either — this is a clean "coming soon" case per the user's own instruction, not a design deviation of convenience. |
| Footer | Static shell | `shared/footer/`. Every link routes to "coming soon". |

## Why product cards don't show a rating, review count, or "before/after" price
`GET /public/products/list`'s summary (`toPublicProductSummary()` in
`manufest_be/src/modules/products/products.api.js`) has no
rating/review-count field at all (no reviews module exists), and its
`pricing` is a `{from, to}` **range** across variants — not a discounted-vs-
original pair like the design mock shows. `shared/product-card/` renders
only what's real: thumbnail, name, seller name, price range. See that
component's own header comment.

## The `thumbnail` field
`GET /public/products/list` never returned a list-view image before this
build — only the detail route carried media. A `thumbnail: {url,
mediaType} | null` field was added to the public list/list_by_seller
responses server-side (`manufest_be`, 2026-09-08) specifically so this
page's product grid has something to show without an extra
request-per-card round-trip to the detail route (which also isn't free —
it increments `view_count`). See `manufest_be`'s own
`.claude/knowledge/02-api-reference.md` and `10-todos-and-stubs.md` for the
backend side of this change.
