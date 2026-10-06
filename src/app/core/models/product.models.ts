/**
 * Shapes returned by manufest_be's `products` module public routes
 * (`src/modules/products/products.api.js`'s `publicRouter` —
 * `toPublicProductSummary`/`toPublicProductDetail`/`toPublicVariant`/
 * `toPublicPricing`). See manufest_be/.claude/knowledge/02-api-reference.md's
 * `products` section for the full route table this was built against.
 *
 * Only fields the public routes actually return are modeled here — no
 * rating/review-count/discount-badge fields exist on the backend today, so
 * none are declared here either (see ProductCardComponent's header comment
 * for why the UI doesn't fabricate any of that).
 */

export interface MediaItem {
  uuid: string;
  mediaType: 'image' | 'video';
  /**
   * The raw, private productMediaStorage S3 URL — loading this directly in
   * an `<img>`/`<video>` 403s (the bucket has no public-read policy, by
   * product decision — see manufest_be's
   * `.claude/knowledge/05-config-env.md`). Always resolve it through
   * `ProductService.mediaSrc()` first, which rewrites it to
   * `GET /public/products/media?url=`.
   */
  url: string;
  sortOrder: number;
  /** True for the one image (never a video) the seller picked as this
   * variant's thumbnail/default — see product-detail.component.ts's
   * `selectVariant()`, which opens a variant's gallery on this image
   * instead of just whichever was uploaded first. */
  isPrimary: boolean;
}

/** `null` when a product has no variant media uploaded yet. */
export type ProductThumbnail = Pick<MediaItem, 'url' | 'mediaType'> | null;

export interface ProductPriceRange {
  from: number | null;
  to: number | null;
}

/** Minimal shape `ProductCardComponent` actually reads (uuid, name, price
 * range, thumbnail — see that component's own header comment for why it
 * renders nothing else). `ProductSummary` below is a structural superset,
 * so it satisfies this for free; the narrower type also lets a slimmer
 * response — `GET /customer/recently-viewed`'s `product` sub-object
 * carries no `productType`/`category`/`seller`/etc — feed the same card
 * without fabricating placeholder values for fields it never uses. */
export interface ProductCardSummary {
  uuid: string;
  productName: string;
  pricing: ProductPriceRange;
  thumbnail: ProductThumbnail;
  /** `brandName` is the seller's registered brand, or their name when they
   * have none (manufest_be's sellerBrandNameSql). Recently-viewed rows
   * carry only `brandName`. */
  seller?: { uuid?: string; name?: string; brandName?: string | null };
  /** `false` when no active variant is in stock — the card shows "Out of
   * stock" up front. Absent from older backends: treat as in stock. */
  inStock?: boolean;
}

export interface ProductSummary extends ProductCardSummary {
  sku: string;
  productType: 'SAREE' | 'NON_SAREE' | string;
  isActive?: boolean;
  productApproval: string;
  lifecycleStatus: string;
  category?: { uuid: string; name: string };
  seller?: { uuid: string; name: string; brandName?: string | null };
  createdAt: string;
}

/** `GET /public/products/detail/:productUuid/related` — added 2026-09-24,
 * same shape as `ProductSummary` (`toPublicProductSummary()` reused
 * as-is) plus the ranking score that produced this ordering. Category is
 * a hard boundary (every result shares it with the viewed product); the
 * score itself isn't shown anywhere, just used to order the grid the
 * backend already returned in relevance order. */
export interface RelatedProduct extends ProductSummary {
  relevanceScore: number;
}

/** Per-variant pricing breakdown — `toPublicPricing()`. Detail view only. */
export interface VariantPricing {
  sellerPrice: number;
  commissionPercent: number;
  commissionPrice: number;
  gstPercentForCommission: number;
  gstPriceForCommission: number;
  netAmount: number;
  gstPercentOnNetAmount: number;
  gstPriceOnNetAmount: number;
  checkoutPrice: number;
  discountPercent: number;
  discountPrice: number;
  sellingPrice: number;
}

export interface VariantInventory {
  quantityAvailable: number;
  quantityReserved: number;
  quantitySold: number;
  quantityDamaged: number;
  quantityReturned: number;
  lowStockThreshold: number;
  isInStock: boolean;
}

export interface ProductVariant {
  uuid: string;
  variantName: string | null;
  size: string | null;
  variantSkuPrefix: string;
  colorHex: string | null;
  isActive: boolean;
  pricing: VariantPricing | null;
  inventory: VariantInventory;
  media: MediaItem[];
}

/** `resolveAttributeDisplay()` in products.api.js — `{uuid, name}` lookups
 * resolved from `product_attributes_master`, `null` when that attribute
 * wasn't set on the product. */
export type AttributeLookup = { uuid: string; name: string } | null;

export interface ProductAttributes {
  washCare: string | null;
  material: AttributeLookup;
  fabricPurity: AttributeLookup;
  color: AttributeLookup;
  zariType: AttributeLookup;
  zariColor: AttributeLookup;
  borderType: AttributeLookup;
  occasions: Array<{ uuid: string; name: string }>;
  fabrics: Array<{ uuid: string; name: string }>;
  weaves: Array<{ uuid: string; name: string }>;
  blouseIncluded: boolean;
  sareeLength: string | null;
  blouseLength: string | null;
  hasSale: boolean;
  saleEndDate: string | null;
}

export interface ProductDetail {
  uuid: string;
  seller: { uuid: string };
  category: { uuid: string; name: string };
  subCategory: { uuid: string; name: string } | null;
  productName: string;
  productDesc: string | null;
  sku: string;
  productType: string;
  viewCount: number;
  productApproval: string;
  lifecycleStatus: string;
  isActive: boolean;
  attributes: ProductAttributes;
  variants: ProductVariant[];
  media: MediaItem[];
  createdAt: string;
}
