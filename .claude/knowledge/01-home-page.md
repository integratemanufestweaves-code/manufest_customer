---
generated: 2026-09-08
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
| **Featured Products** | **Live** | `ProductService.listProducts({limit: 10})` → `GET /public/products/list`. Loading skeleton / error / empty states all handled. |
| **Shop by Category** | **Live** | `CategoryService.listCategories()` → `GET /public/categories/list`. Falls back to an initial-letter tile when a category has no `image_url`. |
| "Shop by Occasion" / "Shop by Price" tiles | **Dropped** | No occasion/price-band browsing API exists, and the design's target for these tiles (a full filtered "New Arrivals" page, `home-04-desktop.png`) is itself out of scope for this pass. A section made entirely of dead-end "coming soon" tiles wasn't worth building. |
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
