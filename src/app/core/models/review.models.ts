/**
 * Shapes for manufest_be's `product-reviews` module
 * (`src/modules/product-reviews/productReviews.api.js`) — read from that
 * file's `toPublicReview` and `productReviews.validation.js`'s
 * `createReview` schema.
 *
 * Verified-purchase only: a review hangs off one `order_items` row the
 * customer owns that has reached `delivered`, one review per item
 * (`ALREADY_REVIEWED` on a second try). No approval step: a review is
 * `active` (on the product page) as soon as it's submitted; an admin can
 * set it `inactive` to hide it (0085_product_reviews_active_status.sql).
 *
 * Text + images only — there's no video field on the backend. `images` is
 * a list of URLs, but no customer-facing upload endpoint exists yet, so
 * this app doesn't send any.
 */

export type ReviewStatus = 'active' | 'inactive';

export interface ProductReview {
  uuid: string;
  /** 1–5. */
  rating: number;
  review: string | null;
  images: string[];
  status: ReviewStatus;
  createdAt: string;
}

export interface CreateReviewRequest {
  orderItemUuid: string;
  rating: number;
  /** Max 1000 characters server-side. */
  review?: string;
}
