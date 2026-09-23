import { ProductCardSummary } from './product.models';

/**
 * `manufest_be`'s `recently-viewed` module
 * (`src/modules/recently-viewed/recentlyViewed.api.js`, mounted
 * `/api/v1/customer/recently-viewed`, added 2026-09-23) — a home-page
 * ribbon, not a curated list: `POST /` upserts a (customer, product) view
 * (touches `viewedAt` on a re-view instead of duplicating), `GET /` lists
 * the customer's own, most-recently-viewed first.
 */
export interface RecentlyViewedProduct extends ProductCardSummary {
  sku: string;
}

export interface RecentlyViewedItem {
  uuid: string;
  viewedAt: string;
  /** `true` only if at least one active variant is actually in stock —
   * same NULL-vs-0 distinction the backend's wishlist view makes (see that
   * module's own comment): no active variants at all also reads as
   * out-of-stock here. */
  inStock: boolean;
  product: RecentlyViewedProduct;
}
