/**
 * Shapes for manufest_be's `cart` module (`src/modules/cart/cart.api.js`,
 * mounted `/api/v1/customer/cart`) — read directly from that file's
 * `loadCartView()`, not just the knowledge-base summary. Cart is
 * variant-level (not product-level) — `product_variants_inventory` is the
 * schema's actual pricing/stock granularity, see that file's own header
 * comment.
 */
import { ProductThumbnail } from './product.models';

export interface CartItem {
  uuid: string;
  quantity: number;
  /** Snapshot of the selling price at the moment this was added. */
  priceAtAdd: number;
  /** Re-resolved fresh from `product_pricing.selling_price` on every read —
   * `null` only if the variant somehow lost its pricing row entirely.
   * Compare against `priceAtAdd` to show a "price changed" indicator. */
  currentPrice: number | null;
  /** `currentPrice * quantity`, or `null` if `currentPrice` is `null`. */
  lineTotal: number | null;
  quantityAvailable: number;
  /** `thumbnail` is this specific variant's own primary image (not the
   * product's — a cart line is a picked color/size), `null` if that variant
   * has none uploaded yet. Resolve through `ProductService.mediaSrc()`. */
  variant: { uuid: string; variantName: string | null; colorHex: string | null; thumbnail: ProductThumbnail };
  product: { uuid: string; productName: string };
}

export interface CartView {
  items: CartItem[];
  itemCount: number;
  total: number;
}

export interface AddCartItemRequest {
  variantUuid: string;
  quantity?: number;
}
