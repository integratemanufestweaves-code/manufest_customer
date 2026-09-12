/**
 * Shapes for manufest_be's `wishlist` module
 * (`src/modules/wishlist/wishlist.api.js`, mounted `/api/v1/customer/wishlist`)
 * — read directly from that file's `loadWishlistView()`. Product-level (not
 * variant-level, unlike cart) — "move to cart" is a client-side action that
 * still needs a variant picked, see that file's own header comment.
 */
import { ProductPriceRange } from './product.models';

export interface WishlistItem {
  uuid: string;
  product: {
    uuid: string;
    productName: string;
    sku: string;
    pricing: ProductPriceRange;
  };
}

export interface AddWishlistItemRequest {
  productUuid: string;
}
