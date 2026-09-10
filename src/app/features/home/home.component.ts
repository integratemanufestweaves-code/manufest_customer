import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductSummary } from '../../core/models/product.models';
import { Category } from '../../core/models/category.models';

interface TrustBadge {
  title: string;
  desc: string;
}

/**
 * The one fully "live" page in this app — everything else is a "coming
 * soon" placeholder (see app.routes.ts). Built against
 * `design-reference/user/home/home-01-desktop.png` / `-02-desktop.png` /
 * `-05-tablet.png` / `-06-iphone.png` / `-07-iphone.png`.
 *
 * Sections and what backs them:
 * - Hero banner, trust badges: static creative — no API concept applies
 *   (marketing copy, not data).
 * - Featured Products: **live**, `GET /public/products/list`.
 * - Shop by Category: **live**, `GET /public/categories/list`.
 * - "Shop by Occasion" / "Shop by Price" tiles from the design: dropped.
 *   There's no occasion/price-band browsing API, and building the design's
 *   full filtered "New Arrivals" listing page (home-04-desktop.png) is out
 *   of scope for this pass per the user's own instruction — every such
 *   destination would just be another "coming soon" page, so a home-page
 *   section entirely made of dead-end tiles wasn't worth the section.
 * - Manufacturer spotlight quote + "8,000+ happy customers"-style stat
 *   counters + named customer testimonials with star ratings: **not
 *   implemented as static content.** No reviews/testimonials/manufacturer-
 *   profile module exists in manufest_be, and hardcoding specific invented
 *   numbers, a named manufacturer, and named "customers" with star ratings
 *   would present fabricated data/testimonials as if real. Replaced with
 *   an honest teaser section instead — see the template's `.stories`
 *   block and manufest_customer's own
 *   `.claude/knowledge/01-home-page.md` for the full reasoning.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);

  readonly trustBadges: TrustBadge[] = [
    { title: 'Direct from manufacturer', desc: 'Verified units across India' },
    { title: 'Authenticity assured', desc: 'Pure fabrics & zari' },
    { title: 'Pan-India shipping', desc: 'Safe & reliable delivery' },
    { title: 'Dedicated support', desc: "We're here when you need us" },
  ];

  readonly products = signal<ProductSummary[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal<string | null>(null);

  readonly categories = signal<Category[]>([]);
  readonly categoriesLoading = signal(true);
  readonly categoriesError = signal<string | null>(null);

  ngOnInit(): void {
    this.productService.listProducts({ limit: 10 }).subscribe({
      next: (page) => {
        this.products.set(page.items);
        this.productsLoading.set(false);
      },
      error: (err) => {
        this.productsError.set(err?.message || 'Could not load products right now.');
        this.productsLoading.set(false);
      },
    });

    this.categoryService.listCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories.slice(0, 12));
        this.categoriesLoading.set(false);
      },
      error: (err) => {
        this.categoriesError.set(err?.message || 'Could not load categories right now.');
        this.categoriesLoading.set(false);
      },
    });
  }
}
