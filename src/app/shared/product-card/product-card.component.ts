import { Component, inject, Input } from '@angular/core';
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

  get thumbnailSrc(): string | null {
    return this.productService.mediaSrc(this.product.thumbnail?.url);
  }

  get priceLabel(): string | null {
    const { from, to } = this.product.pricing;
    if (from == null) return null;
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to as number)}`;
  }
}
