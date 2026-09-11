import { Component, inject, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
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
 * The "+ Add to cart" footer link (added 2026-09-10, for design parity with
 * the Featured Products / listing-page grids) routes to the shared
 * "coming soon" `/cart` page, same as product-detail's own Add to cart —
 * no cart-mutation endpoint is wired into this app yet even though
 * `manufest_be` now has a `cart` module (see app.routes.ts's header
 * comment). It's a sibling `<a>` next to `.card__link`, not nested inside
 * it, so the card stays valid markup (no interactive-in-interactive
 * nesting) and the two links don't fight over clicks.
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
}
