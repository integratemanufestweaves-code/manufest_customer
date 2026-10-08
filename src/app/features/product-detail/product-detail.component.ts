import { Component, computed, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ReviewService } from '../../core/services/review.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ProductDetail, ProductVariant, RelatedProduct } from '../../core/models/product.models';
import { ProductReview } from '../../core/models/review.models';
import { formatPrice } from '../../core/utils/format-price';

/**
 * `GET /public/products/detail/:productUuid` — see
 * manufest_be/.claude/knowledge/02-api-reference.md's `products` section.
 * Reachable only by clicking a product card (no route exists that lists
 * all products yet, per the scope decisions in home.component.ts). "Add to
 * cart"/wishlist-heart wired to real `cart`/`wishlist` module calls
 * 2026-09-12 — see `CUSTOMER_APP_TODO.md`'s §2/§3.
 *
 * Also records this view (added 2026-09-24) — fire-and-forget `POST
 * /customer/recently-viewed`, only when a customer session exists (see
 * `recently-viewed.models.ts`'s header comment for why this is a separate
 * call from the public detail fetch above, not folded into it), and shows
 * a "You may also like" related-products strip (`GET
 * .../related`, public, no auth needed) — both render nothing at all if
 * there's nothing to show, same "no empty section" rule as the home
 * page's Recently Viewed ribbon.
 *
 * Customer reviews (added 2026-10-07) come from `GET /public/product-reviews
 * /products/:productUuid/reviews` — active reviews only (an admin can hide
 * one; there's no approval step), newest first,
 * paged. The average shown under the title and above the list is the
 * backend's `rating` (over every active review), not an average of the
 * loaded page.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly recentlyViewedService = inject(RecentlyViewedService);
  private readonly reviewService = inject(ReviewService);
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);
  /** In-flight requests for the product being shown; cancelled when the
   * shopper moves to another product before they finish. */
  private loadSubs = new Subscription();

  readonly product = signal<ProductDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly selectedMediaUrl = signal<string | null>(null);

  readonly relatedProducts = signal<RelatedProduct[]>([]);

  readonly reviews = signal<ProductReview[]>([]);
  readonly reviewTotal = signal(0);
  private reviewPage = 1;
  readonly reviewsLoading = signal(false);
  readonly reviewsError = signal<string | null>(null);
  readonly hasMoreReviews = computed(() => this.reviews().length < this.reviewTotal());

  readonly addingToCart = signal(false);
  readonly addToCartError = signal<string | null>(null);
  readonly addedToCart = signal(false);
  /** Once this colour is in the cart the button becomes "Go to cart" —
   * quantity is changed in the cart, not by adding again here. */
  readonly selectedVariantInCart = computed(() => {
    const variant = this.selectedVariant();
    return !!variant && this.cartService.isVariantInCart(variant.uuid);
  });

  /** Watches the route, not a one-off snapshot: clicking a "You may also
   * like" card goes from /product/A to /product/B, and the Router reuses
   * this same component instance for that, so ngOnInit never runs again.
   * Reading the snapshot once left the page showing product A (2026-10-05). */
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.load(params.get('productUuid')));
    this.destroyRef.onDestroy(() => this.loadSubs.unsubscribe());
  }

  private load(productUuid: string | null): void {
    this.loadSubs.unsubscribe();
    this.loadSubs = new Subscription();
    this.product.set(null);
    this.relatedProducts.set([]);
    this.error.set(null);
    this.loading.set(true);
    this.selectVariant(null);

    if (!productUuid) {
      this.error.set('Product not found.');
      this.loading.set(false);
      return;
    }

    this.loadSubs.add(this.productService.getProductDetail(productUuid).subscribe({
      next: (product) => {
        this.product.set(product);
        // `?variant=` comes from a colour swatch on a product card — open on
        // that colour; anything unknown falls back to the first variant.
        const requested = this.route.snapshot.queryParamMap.get('variant');
        const initialVariant = product.variants.find((v) => v.uuid === requested) ?? product.variants[0] ?? null;
        this.selectVariant(initialVariant);
        this.loading.set(false);
        this.analytics.productView({
          productUuid: product.uuid,
          name: product.productName,
          price: initialVariant?.pricing?.sellingPrice ?? null,
          variant: initialVariant?.variantName ?? null,
        });
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load this product right now.');
        this.loading.set(false);
      },
    }));

    if (this.auth.isAuthenticated()) {
      // Fire-and-forget — a failed view-record must never affect the page
      // the customer is actually trying to see.
      this.recentlyViewedService.recordView(productUuid).subscribe({ error: () => undefined });
    }

    this.loadSubs.add(this.productService.getRelatedProducts(productUuid).subscribe({
      next: (related) => this.relatedProducts.set(related),
      // Same "no error banner for a nice-to-have strip" call as the home
      // page's Recently Viewed section.
      error: () => this.relatedProducts.set([]),
    }));

    this.loadReviews(productUuid, 1);
  }

  private loadReviews(productUuid: string, page: number): void {
    if (page === 1) {
      this.reviews.set([]);
      this.reviewTotal.set(0);
    }
    this.reviewPage = page;
    this.reviewsLoading.set(true);
    this.reviewsError.set(null);
    this.loadSubs.add(this.reviewService.listForProduct(productUuid, page).subscribe({
      next: ({ items, meta }) => {
        this.reviews.update((existing) => (page === 1 ? items : [...existing, ...items]));
        this.reviewTotal.set(meta?.totalCount ?? items.length);
        this.reviewsLoading.set(false);
      },
      error: (err) => {
        this.reviewsError.set(err?.message || 'Could not load reviews right now.');
        this.reviewsLoading.set(false);
      },
    }));
  }

  loadMoreReviews(): void {
    const p = this.product();
    if (p && !this.reviewsLoading()) this.loadReviews(p.uuid, this.reviewPage + 1);
  }

  formatReviewDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  roundStars(average: number): number {
    return Math.min(5, Math.max(0, Math.round(average)));
  }

  scrollToReviews(event: Event): void {
    event.preventDefault();
    document.getElementById('pd-reviews-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  selectVariant(variant: ProductVariant | null): void {
    this.selectedVariant.set(variant);
    this.addedToCart.set(false);
    this.addToCartError.set(null);
    // Open the gallery on the seller-picked primary image (the same one
    // used as this product's thumbnail elsewhere) rather than whichever
    // happened to be uploaded first — falls back to the first media item
    // for a variant that has no primary flagged yet (e.g. videos only).
    const primaryOrFirstMedia = variant?.media?.find((m) => m.isPrimary) ?? variant?.media?.[0];
    this.selectedMediaUrl.set(primaryOrFirstMedia ? this.productService.mediaSrc(primaryOrFirstMedia.url) : null);
  }

  selectMedia(url: string): void {
    this.selectedMediaUrl.set(this.productService.mediaSrc(url));
  }

  mediaSrc(url: string): string | null {
    return this.productService.mediaSrc(url);
  }

  formatPrice(n: number): string {
    return formatPrice(n);
  }

  /** Multi-value attributes (occasions, fabrics, weaves) as one line. */
  names(items: Array<{ name: string }> | null | undefined): string {
    return (items ?? []).map((i) => i.name).join(', ');
  }

  /** Saree/blouse lengths are free text from the seller — a bare number
   * ("6", "0.8") gets metres added; anything with its own unit is kept. */
  lengthLabel(value: string): string {
    const trimmed = value.trim();
    return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed} m` : trimmed;
  }

  get isWishlisted(): boolean {
    const p = this.product();
    return p ? this.wishlistService.isWishlisted(p.uuid) : false;
  }

  toggleWishlist(): void {
    const p = this.product();
    if (!p) return;
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirectTo: this.router.url } });
      return;
    }
    this.wishlistService.toggle(p.uuid).subscribe();
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }

  addToCart(): void {
    const variant = this.selectedVariant();
    if (!variant) return;
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirectTo: this.router.url } });
      return;
    }

    this.addToCartError.set(null);
    this.addedToCart.set(false);
    this.addingToCart.set(true);
    this.cartService.addItem({ variantUuid: variant.uuid }).subscribe({
      next: () => {
        this.addingToCart.set(false);
        this.addedToCart.set(true);
        const product = this.product();
        if (product) {
          this.analytics.addToCart({
            productUuid: product.uuid,
            name: product.productName,
            price: variant.pricing?.sellingPrice ?? null,
            variant: variant.variantName,
          });
        }
      },
      error: (err) => {
        this.addToCartError.set(err?.message || 'Could not add this to your cart.');
        this.addingToCart.set(false);
      },
    });
  }
}
