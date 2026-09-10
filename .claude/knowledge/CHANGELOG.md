# Changelog

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
