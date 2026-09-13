import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { WishlistService } from '../../core/services/wishlist.service';
import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { WishlistItem } from '../../core/models/wishlist.models';

/**
 * `GET/POST/DELETE /customer/wishlist*` (`wishlist.api.js`) — product-level,
 * not variant-level (see that file's header comment), so "Move to cart"
 * has to resolve a variant client-side before it can call
 * `POST /customer/cart/items`. `loadWishlistView()` now also returns a
 * product-level `thumbnail` (2026-09-13) — resolved through
 * `ProductService.mediaSrc()` the same way `ProductCardComponent` resolves
 * its own, with the same per-item "fell back to the placeholder because the
 * underlying object 404d" broken-image handling.
 */
@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './wishlist.component.html',
  styleUrl: './wishlist.component.scss',
})
export class WishlistComponent implements OnInit {
  private readonly wishlistService = inject(WishlistService);
  private readonly cartService = inject(CartService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  readonly items = this.wishlistService.items;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pendingItem = signal<string | null>(null);

  /** Wishlist item uuids whose resolved thumbnail 404d — see
   * ProductCardComponent's `thumbnailBroken` for why this falls back to the
   * placeholder icon instead of a broken-image glyph. */
  private readonly brokenThumbnails = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.wishlistService.refresh();
    this.loading.set(false);
  }

  formatPrice(n: number): string {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  thumbnailSrc(item: WishlistItem): string | null {
    if (this.brokenThumbnails().has(item.uuid)) return null;
    return this.productService.mediaSrc(item.product.thumbnail?.url);
  }

  onThumbnailError(item: WishlistItem): void {
    this.brokenThumbnails.update((set) => new Set(set).add(item.uuid));
  }

  priceLabel(item: WishlistItem): string | null {
    const { from, to } = item.product.pricing;
    if (from == null) return null;
    return from === to ? this.formatPrice(from) : `${this.formatPrice(from)} – ${this.formatPrice(to as number)}`;
  }

  remove(item: WishlistItem): void {
    this.pendingItem.set(item.uuid);
    this.error.set(null);
    this.wishlistService.remove(item.uuid).subscribe({
      next: () => this.pendingItem.set(null),
      error: (err) => {
        this.error.set(err?.message || 'Could not remove that item.');
        this.pendingItem.set(null);
      },
    });
  }

  /** A single-variant product moves straight to the cart. A product with a
   * color/size choice sends the customer to its detail page instead of
   * guessing which variant they meant — no variant-picker modal exists
   * here yet, and silently picking "the first one" for a saree available
   * in five colours would be actively wrong. */
  moveToCart(item: WishlistItem): void {
    this.pendingItem.set(item.uuid);
    this.error.set(null);
    this.productService.getProductDetail(item.product.uuid).subscribe({
      next: (product) => {
        const variants = product.variants.filter((v) => v.isActive);
        if (variants.length === 1) {
          this.cartService.addItem({ variantUuid: variants[0].uuid }).subscribe({
            next: () => {
              this.wishlistService.remove(item.uuid).subscribe({ next: () => this.pendingItem.set(null) });
            },
            error: (err) => {
              this.error.set(err?.message || 'Could not add that to your cart.');
              this.pendingItem.set(null);
            },
          });
        } else {
          this.pendingItem.set(null);
          this.router.navigate(['/product', item.product.uuid]);
        }
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load that product.');
        this.pendingItem.set(null);
      },
    });
  }
}
