import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { ResponsiveBannerComponent } from '../../shared/responsive-banner/responsive-banner.component';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductSummary } from '../../core/models/product.models';
import { Category } from '../../core/models/category.models';

interface TrustBadge {
  title: string;
  desc: string;
}

interface PriceBand {
  label: string;
  min: number | null;
  max: number | null;
  /** `assets/tiles/<bucket>/` folder this tile's rotating photo comes from — see `tileImage()`. */
  bucket: string;
}

interface OccasionTile {
  label: string;
  /** `assets/tiles/<bucket>/` folder this tile's rotating photo comes from — see `tileImage()`. */
  bucket: string;
}

interface StatCounter {
  value: string;
  label: string;
}

interface GrowBusinessPoint {
  title: string;
  desc: string;
}

interface CustomerReview {
  name: string;
  quote: string;
}

/**
 * The one fully "live" page in this app — everything else is a "coming
 * soon" placeholder (see app.routes.ts). Built against `ui_design/Home
 * Page.png` (see `.claude/knowledge/00-overview.md`'s "Design reference"
 * section).
 *
 * Sections and what backs them:
 * - Hero banner, trust badges: static creative — no API concept applies
 *   (marketing copy, not data).
 * - Featured Products: **live**, `GET /public/products/list`, "View all"
 *   goes to the real `/new-arrivals` listing page.
 * - Shop by Category: **live**, `GET /public/categories/list`; each tile
 *   goes to `/category/:categoryUuid` (`ProductListingComponent`).
 * - Shop by Occasion: **static** (added 2026-09-10) — fixed tiles using
 *   the same occasion vocabulary `ProductAttributes.occasions` and the
 *   `Sort by`/`View all` design mocks' filter sidebar already use (Daily
 *   Wear, Office/Work Wear, etc.), *not* fetched from an API. There is
 *   still no public endpoint that lists occasion values at all (`GET
 *   /public/products/list` gained an `occasionUuid` *filter* on
 *   2026-09-10, but nothing publicly exposes the *choices* to filter by —
 *   see `ProductListingComponent`'s header comment), so these tiles link
 *   to plain `/new-arrivals` (unfiltered) rather than a specific
 *   `occasionUuid` this page has no way to know. Swap in real per-tile
 *   `occasionUuid` links the moment such an endpoint exists.
 * - Shop by Price: **live** (added 2026-09-10, alongside `manufest_be`'s
 *   `priceMin`/`priceMax` filter) — fixed price-band tiles link into
 *   `/new-arrivals` with those query params pre-set. Unlike Featured
 *   Products/Categories this has no list to fetch (the bands are a fixed
 *   UI convention, same six bands `ProductListingComponent`'s sidebar
 *   offers as presets), so it's plain static markup, not a loading state.
 * - Manufacturer spotlight quote, stat counters, "Grow your business",
 *   and customer review cards: **static placeholder content, added
 *   2026-09-10 at the user's explicit direction** to match `ui_design/Home
 *   Page.png` pixel-for-pixel, superseding this file's earlier decision
 *   (see CHANGELOG.md's first 2026-09-10 entry) to omit these sections
 *   because no reviews/testimonials/manufacturer-profile module exists in
 *   `manufest_be`. The specific manufacturer name/quote, stat counters
 *   (8,000+ happy customers, etc.), and reviewer name/quote/star-rating
 *   are copied verbatim from the design mock, not invented here — but
 *   they are still fabricated-looking content with no live data behind
 *   them. **Flagged explicitly: presenting named customer
 *   testimonials/star ratings as real reviews when they aren't is a
 *   genuine legal/trust risk (FTC-style endorsement-disclosure rules) if
 *   this ships to production as-is — replace with real review data (or
 *   clearly label it as sample content) before launch.** Photo slots use
 *   the shared `.ph-image` placeholder (an icon + a flat brand-toned
 *   background, same "no fabricated photo" instinct as everywhere else in
 *   this app) — swap each `.ph-image` for a real `<img>` once real photo
 *   assets exist; see this file's template for exactly which four spots
 *   (`hero`, `spotlight`, `grow`, `review`) need one each.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, ResponsiveBannerComponent],
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

  /** Links straight into `ProductListingComponent`'s real `priceMin`/
   * `priceMax` filter (manufest_be, 2026-09-10) — see that component's
   * header comment. `min: null` for the first band simply omits `priceMin`
   * from the URL (Angular drops `null` query params). */
  readonly priceBands: PriceBand[] = [
    { label: 'Under ₹5,000', min: null, max: 5000, bucket: 'price-under-5k' },
    { label: '₹5,000 – 10,000', min: 5000, max: 10000, bucket: 'price-5-10k' },
    { label: '₹10,000 – 20,000', min: 10000, max: 20000, bucket: 'price-10-20k' },
    { label: '₹20,000 – 30,000', min: 20000, max: 30000, bucket: 'price-20-30k' },
    { label: '₹30,000 – 50,000', min: 30000, max: 50000, bucket: 'price-30-50k' },
    { label: '₹50,000 – 1,00,000', min: 50000, max: 100000, bucket: 'price-50k-1l' },
  ];

  /** Same occasion vocabulary as `ProductAttributes.occasions` / the
   * design's own filter-sidebar checkbox list — not fetched from anywhere,
   * see this class's header comment. */
  readonly occasions: OccasionTile[] = [
    { label: 'Daily Wear', bucket: 'occasion-daily-wear' },
    { label: 'Office / Work Wear', bucket: 'occasion-office-work' },
    { label: 'Casual Outing', bucket: 'occasion-casual-outing' },
    { label: 'Festival Wear', bucket: 'occasion-festival-wear' },
    { label: 'Wedding / Bridal', bucket: 'occasion-wedding-bridal' },
    { label: 'Party Wear', bucket: 'occasion-party-wear' },
  ];

  /** Static placeholder — see this class's header comment. */
  readonly manufacturerSpotlight = {
    name: 'Annapoorna Handloom Works',
    location: 'Kanchipuram',
    quote:
      "We have been weaving sarees for generations, carrying forward techniques passed down through our family. Every saree made in our unit is crafted with care, attention to detail, and respect for tradition. Partnering with Manufest allows us to bring our sarees directly to customers, ensuring authenticity, fair pricing, and uncompromised quality.",
    author: 'Sai Kumar, Manager',
  };

  /** Static placeholder — see this class's header comment. */
  readonly stats: StatCounter[] = [
    { value: '8,000+', label: 'Happy Customers' },
    { value: '600+', label: 'Handcrafted Saree Designs' },
    { value: '70+', label: 'Verified Manufacturing Units' },
    { value: '18+', label: 'Weaving Regions Across India' },
  ];

  /** Static placeholder — see this class's header comment. Links to the
   * same `/sell-on-manufest` route the footer's "Sell on Manufest" link
   * uses (still "coming soon" — manufacturer sign-up lives in the separate
   * `manufest_seller` app). */
  readonly growBusinessPoints: GrowBusinessPoint[] = [
    { title: 'Direct-to-customer distribution', desc: 'Sell straight to buyers — no middlemen taking a cut.' },
    { title: 'Fair, transparent pricing', desc: 'You set your price; commission is disclosed upfront.' },
    { title: 'Easy onboarding', desc: 'Get your catalogue live in days, not weeks.' },
  ];

  /** Static placeholder — see this class's header comment for the
   * FTC-style endorsement-disclosure flag on shipping this as real
   * reviews. */
  readonly reviews: CustomerReview[] = [
    { name: 'Ananya Pandey', quote: 'The saree quality is exactly as shown. The fabric feels premium and delivery was quick.' },
    { name: 'Priya Ramesh', quote: 'Loved the authenticity — you can tell these are handwoven, not mass-produced.' },
    { name: 'Sneha Iyer', quote: 'Beautiful colours in person, packaging was careful, and pricing felt fair.' },
    { name: 'Divya Menon', quote: 'My go-to now for festive sarees. The zari work is stunning.' },
    { name: 'Kavya Nair', quote: 'Great experience end to end — easy to order and the saree arrived well before the date I needed it.' },
  ];

  /** `null` while ResponsiveBannerComponent's initial request for
   * 'home_hero_banner' is in flight, then `true`/`false` once it resolves
   * — the static fallback markup in home.component.html only renders once
   * this is explicitly `false`, so there's no flash of static content
   * before a real live banner replaces it. See
   * ResponsiveBannerComponent's header comment. */
  readonly heroBannerHasAssets = signal<boolean | null>(null);

  readonly products = signal<ProductSummary[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal<string | null>(null);

  readonly categories = signal<Category[]>([]);
  readonly categoriesLoading = signal(true);
  readonly categoriesError = signal<string | null>(null);
  /** Category uuids whose `imageUrl` 404'd/failed to load — falls back to
   * the initial-letter tile instead of a broken-image icon. A category
   * having *some* `image_url` string doesn't guarantee it resolves (seed/
   * placeholder data, a since-deleted asset, a transient network blip),
   * and this is a public storefront — a broken-image icon looks
   * unpolished in a way a plain letter tile doesn't. */
  readonly brokenCategoryImages = signal<Set<string>>(new Set());

  onHeroBannerLoaded(hasAssets: boolean): void {
    this.heroBannerHasAssets.set(hasAssets);
  }

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

  onCategoryImageError(categoryUuid: string): void {
    this.brokenCategoryImages.update((set) => new Set(set).add(categoryUuid));
  }

  /**
   * A category with no `image_url` (or one that failed to load) used to
   * fall back to a bare initial letter/icon — better than a broken-image
   * icon, but not much of a substitute for a real product photo. This maps
   * the category name to one of the curated "category-" prefixed
   * `assets/tiles/` photo sets `tileImage()` rotates through instead (falls back to
   * `category-generic` for any name that doesn't match the three seeded in
   * `manufest_be`'s dev DB today — Blouses/Dress Materials/Sarees — so a
   * future/unrecognized category name still gets a real photo, never a
   * blank tile). Not a replacement for `CategoryService.listCategories()`'s
   * `image_url` once categories actually have real photos uploaded — that
   * still wins whenever it resolves (see this file's template).
   */
  categoryImageBucket(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('blouse')) return 'category-blouses';
    if (n.includes('dress material') || n.includes('raw') || n.includes('fabric')) return 'category-dress-materials';
    if (n.includes('saree') || n.includes('sari')) return 'category-sarees';
    return 'category-generic';
  }

  /**
   * Deterministic "today's pick" out of a `assets/tiles/<bucket>/1.webp`..
   * `10.webp` set — same index for every visitor all day (no per-request
   * randomness, so the page stays consistent within a load and across a
   * shared link), then rolls over to the next image once the calendar date
   * changes. `Date.now()` (not a stored "day of year") so it keeps working
   * correctly across year boundaries without a Jan-1 reset.
   */
  private static readonly TILE_IMAGE_COUNT = 10;
  private readonly dayIndex = Math.floor(Date.now() / 86400000);

  tileImage(bucket: string): string {
    const n = (this.dayIndex % HomeComponent.TILE_IMAGE_COUNT) + 1;
    return `assets/tiles/${bucket}/${n}.webp`;
  }
}
