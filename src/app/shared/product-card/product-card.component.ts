import { Component, inject, Input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductCardSummary, ProductVariant } from '../../core/models/product.models';
import { formatPrice } from '../../core/utils/format-price';

/**
 * Reusable product tile for grids (Home's "Featured Products", eventually
 * any listing page). Deliberately shows only fields `GET
 * /public/products/list` actually returns — see product.models.ts's header
 * comment. The design mock
 * (`design-reference/user/home/home-01-desktop.png`) also shows a star
 * rating and review count — shown since 2026-10-07 from `product.rating`
 * (active customer reviews; hidden when there are none) — plus a
 * strikethrough "original" price next to a discounted one, and a "Limited
 * Stock" label, neither of which exists on the public list API today (list
 * summaries carry a `pricing: {from, to}` *range*, not an original-vs-
 * discounted pair; and list summaries carry no per-variant stock data).
 * Rather than invent plausible-looking numbers, this card only renders
 * what's real. See manufest_customer's own `.claude/knowledge/01-home-page.md`
 * for the full list of these deviations (same documentation discipline
 * manufest_seller's `03-design-reference-map.md` uses for its own
 * API-driven deviations from the mock).
 *
 * The "+ Add to cart" footer button (added 2026-09-10, for design parity
 * with the Featured Products / listing-page grids; wired to a real
 * `cart.api.js` call 2026-09-12) is a sibling `<button>` next to
 * `.card__link`, not nested inside it, so the card stays valid markup (no
 * interactive-in-interactive nesting) and the two don't fight over clicks.
 * `GET /public/products/list`'s summary carries no variant list (only a
 * `pricing: {from, to}` range) — cart is variant-level, so a "quick add"
 * from the grid has to resolve one first via a `getProductDetail()` call.
 * A product with more than one active variant (color/size choice) can't
 * be quick-added blindly — instead of silently picking "the first colour",
 * the card swaps the button for that product's colour swatches, and
 * clicking one opens the detail page on that variant (`?variant=`).
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductCardSummary;

  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly addingToCart = signal(false);
  readonly addToCartError = signal<string | null>(null);
  /** Set when "+ Add to cart" finds more than one active variant — the
   * card then shows these as swatches instead of the button. */
  readonly variantChoices = signal<ProductVariant[] | null>(null);

  /** Set once the resolved `thumbnailSrc` 404s/fails to load — falls back
   * to the placeholder icon instead of a broken-image glyph. A truthy
   * `thumbnail.url` doesn't guarantee the underlying S3 object still
   * resolves (seed/test data, a deleted asset, a transient proxy error),
   * and a broken-image icon looks unpolished on a public storefront grid
   * where every other card has a real photo. */
  readonly thumbnailBroken = signal(false);

  get thumbnailSrc(): string | null {
    if (this.thumbnailBroken()) return null;
    return this.productService.mediaSrc(this.product.thumbnail?.url);
  }

  onThumbnailError(): void {
    this.thumbnailBroken.set(true);
  }

  /** The cheapest variant's price only, not the from–to range
   * (2026-10-05, user-directed); the thumbnail is that same variant's
   * photo (manufest_be's THUMBNAIL_ORDER_SQL). */
  get priceLabel(): string | null {
    const { from } = this.product.pricing;
    return from == null ? null : formatPrice(from);
  }

  /** The seller's brand, else their name, else "Manufest Weaves" (same
   * fallback as main's 3f5e169) — shown under the product name. */
  get sellerLabel(): string {
    const seller = this.product.seller;
    return seller?.brandName?.trim() || seller?.name?.trim() || 'Manufest Weaves';
  }

  /** Only an explicit `false` from the API counts — a missing flag
   * (older backend) keeps the normal "+ Add to cart". */
  get isOutOfStock(): boolean {
    return this.product.inStock === false;
  }

  /** Any colour of this product already in the cart — the button becomes
   * "Go to cart" (quantity is changed in the cart, not by adding again). */
  get isInCart(): boolean {
    return this.cartService.isProductInCart(this.product.uuid);
  }

  goToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/cart']);
  }

  get isWishlisted(): boolean {
    return this.wishlistService.isWishlisted(this.product.uuid);
  }

  toggleWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirectTo: this.router.url } });
      return;
    }
    this.wishlistService.toggle(this.product.uuid).subscribe();
  }

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isOutOfStock) return;
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirectTo: this.router.url } });
      return;
    }

    this.addToCartError.set(null);
    this.addingToCart.set(true);
    this.productService.getProductDetail(this.product.uuid).subscribe({
      next: (detail) => {
        const variants = detail.variants.filter((v) => v.isActive);
        if (variants.length === 1) {
          // Same `INSUFFICIENT_STOCK` case cart/checkout guard against —
          // checked here too so a stale "1 left" product card doesn't
          // round-trip to the server just to be told no, when the detail
          // response already just said so.
          if (!variants[0].inventory?.isInStock) {
            this.addToCartError.set('Out of stock.');
            this.addingToCart.set(false);
            return;
          }
          this.cartService.addItem({ variantUuid: variants[0].uuid }).subscribe({
            next: () => this.addingToCart.set(false),
            error: (err) => {
              this.addToCartError.set(err?.message || 'Could not add to cart.');
              this.addingToCart.set(false);
            },
          });
        } else if (variants.length > 1) {
          // A colour/size choice exists — don't guess which one, show the
          // choices right here; a swatch click opens that variant's page.
          this.addingToCart.set(false);
          this.variantChoices.set(variants);
        } else {
          this.addToCartError.set('This product is not available right now.');
          this.addingToCart.set(false);
        }
      },
      error: (err) => {
        this.addToCartError.set(err?.message || 'Could not load this product.');
        this.addingToCart.set(false);
      },
    });
  }

  openVariant(variant: ProductVariant): void {
    this.router.navigate(['/product', this.product.uuid], { queryParams: { variant: variant.uuid } });
  }

  closeVariantChoices(): void {
    this.variantChoices.set(null);
  }
}
