import { Component, inject, Input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductSummary } from '../../core/models/product.models';

/**
 * Reusable product tile for grids (Home's "Featured Products", eventually
 * any listing page). Deliberately shows only fields `GET
 * /public/products/list` actually returns — see product.models.ts's header
 * comment. The design mock
 * (`design-reference/user/home/home-01-desktop.png`) also shows a star
 * rating, review count, a strikethrough "original" price next to a
 * discounted one, and a "Limited Stock" label — none of that exists on the
 * public list API today (no reviews/ratings module exists at all; list
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
 * be quick-added blindly — sends the shopper to the detail page instead of
 * silently picking "the first colour" for them.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductSummary;

  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly addingToCart = signal(false);
  readonly addToCartError = signal<string | null>(null);

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

  get priceLabel(): string | null {
    const { from, to } = this.product.pricing;
    if (from == null) return null;
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to as number)}`;
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
          this.cartService.addItem({ variantUuid: variants[0].uuid }).subscribe({
            next: () => this.addingToCart.set(false),
            error: (err) => {
              this.addToCartError.set(err?.message || 'Could not add to cart.');
              this.addingToCart.set(false);
            },
          });
        } else {
          // A colour/size choice exists — don't guess which one, send the
          // shopper to the page where they can actually pick.
          this.addingToCart.set(false);
          this.router.navigate(['/product', this.product.uuid]);
        }
      },
      error: (err) => {
        this.addToCartError.set(err?.message || 'Could not load this product.');
        this.addingToCart.set(false);
      },
    });
  }
}
