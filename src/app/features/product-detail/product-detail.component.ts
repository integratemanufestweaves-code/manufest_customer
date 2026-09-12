import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductDetail, ProductVariant } from '../../core/models/product.models';

/**
 * `GET /public/products/detail/:productUuid` — see
 * manufest_be/.claude/knowledge/02-api-reference.md's `products` section.
 * Reachable only by clicking a product card (no route exists that lists
 * all products yet, per the scope decisions in home.component.ts). "Add to
 * cart"/wishlist-heart wired to real `cart`/`wishlist` module calls
 * 2026-09-12 — see `CUSTOMER_APP_TODO.md`'s §2/§3.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink],
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

  readonly product = signal<ProductDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly selectedMediaUrl = signal<string | null>(null);

  readonly addingToCart = signal(false);
  readonly addToCartError = signal<string | null>(null);
  readonly addedToCart = signal(false);

  ngOnInit(): void {
    const productUuid = this.route.snapshot.paramMap.get('productUuid');
    if (!productUuid) {
      this.error.set('Product not found.');
      this.loading.set(false);
      return;
    }

    this.productService.getProductDetail(productUuid).subscribe({
      next: (product) => {
        this.product.set(product);
        const firstVariant = product.variants[0] ?? null;
        this.selectVariant(firstVariant);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load this product right now.');
        this.loading.set(false);
      },
    });
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
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
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
      },
      error: (err) => {
        this.addToCartError.set(err?.message || 'Could not add this to your cart.');
        this.addingToCart.set(false);
      },
    });
  }
}
