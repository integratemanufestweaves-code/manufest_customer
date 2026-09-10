import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ProductDetail, ProductVariant } from '../../core/models/product.models';

/**
 * `GET /public/products/detail/:productUuid` — see
 * manufest_be/.claude/knowledge/02-api-reference.md's `products` section.
 * Reachable only by clicking a product card (no route exists that lists
 * all products yet, per the scope decisions in home.component.ts). "Add to
 * cart" / wishlist-heart intentionally route to "coming soon" — there is
 * no cart/wishlist module in manufest_be yet.
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
  private readonly productService = inject(ProductService);

  readonly product = signal<ProductDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly selectedMediaUrl = signal<string | null>(null);

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
}
