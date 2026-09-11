import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { ProductService, ProductSort } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductSummary } from '../../core/models/product.models';

interface PricePreset {
  label: string;
  min: number | null;
  max: number | null;
}

/**
 * Real, filterable product browsing page — built against
 * `manufest_be`'s 2026-09-10 `GET /public/products/list` change (5 new
 * optional query params: `categoryUuid`/`occasionUuid`/`priceMin`/
 * `priceMax`/`sort`, see manufest_be/.claude/knowledge/02-api-reference.md's
 * "Filterable public listing" entry). Serves two routes that only differ in
 * whether a category is pinned: `/new-arrivals` (no category — "new
 * arrivals" is itself just `sort=newest`, the API's default) and
 * `/category/:categoryUuid` (Home's "Shop by Category" tiles).
 *
 * Matches `ui_design/Sort by.png` / `ui_design/View all.png` — filters
 * sidebar + sort dropdown + product grid + breadcrumb — but only with the
 * filter controls the API actually supports. The design mock also shows
 * Brand/Colour/Discount/Blouse/Fabric-purity/Material/Zari/Border-type
 * checkbox filters and a "Popularity"/"Better Discount" sort — none of
 * those are implemented because `applyPublicListFilters()` doesn't accept
 * them and there's no public endpoint to even list the available values for
 * most of them (`/seller/products/attributes-master` and
 * `/admin/products/attributes-master` are both auth-gated). Building
 * checkboxes with no working filter behind them would be a fake control,
 * not a coming-soon page — so they're left out entirely rather than
 * disabled or stubbed. Same reasoning as `home.component.ts`'s dropped
 * "Shop by Occasion"/testimonial sections.
 */
@Component({
  selector: 'app-product-listing',
  standalone: true,
  imports: [RouterLink, FormsModule, ProductCardComponent],
  templateUrl: './product-listing.component.html',
  styleUrl: './product-listing.component.scss',
})
export class ProductListingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly destroy$ = new Subject<void>();

  readonly pricePresets: PricePreset[] = [
    { label: 'Under ₹5,000', min: null, max: 5000 },
    { label: '₹5,000 – 10,000', min: 5000, max: 10000 },
    { label: '₹10,000 – 20,000', min: 10000, max: 20000 },
    { label: '₹20,000 – 30,000', min: 20000, max: 30000 },
    { label: '₹30,000 – 50,000', min: 30000, max: 50000 },
    { label: '₹50,000 – 1,00,000', min: 50000, max: 100000 },
  ];

  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly hasMore = signal(false);

  readonly categoryUuid = signal<string | null>(null);
  readonly categoryName = signal<string | null>(null);
  readonly sort = signal<ProductSort>('newest');
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);
  readonly priceError = signal<string | null>(null);

  readonly filtersOpen = signal(false);

  readonly heading = computed(() => this.categoryName() ?? 'New Arrivals');
  readonly hasActiveFilters = computed(() => this.priceMin() != null || this.priceMax() != null || this.sort() !== 'newest');

  priceMinInput = '';
  priceMaxInput = '';

  private requestToken = 0;

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        const categoryUuid = params.get('categoryUuid');
        const categoryChanged = categoryUuid !== this.categoryUuid();
        this.categoryUuid.set(categoryUuid);

        this.sort.set(query.get('sort') === 'oldest' ? 'oldest' : 'newest');
        const min = query.get('priceMin');
        const max = query.get('priceMax');
        this.priceMin.set(min != null && min !== '' ? Number(min) : null);
        this.priceMax.set(max != null && max !== '' ? Number(max) : null);
        this.priceMinInput = min ?? '';
        this.priceMaxInput = max ?? '';
        this.priceError.set(null);

        if (categoryChanged) {
          this.categoryName.set(null);
          if (categoryUuid) {
            this.categoryService.getCategory(categoryUuid).subscribe({
              next: (cat) => this.categoryName.set(cat.name),
              error: () => this.categoryName.set(null),
            });
          }
        }

        this.fetchProducts(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchProducts(append: boolean): void {
    const token = ++this.requestToken;
    if (!append) {
      this.loading.set(true);
      this.products.set([]);
    }
    this.error.set(null);

    this.productService
      .listProducts({
        limit: 20,
        cursor: append ? this.nextCursor() : null,
        categoryUuid: this.categoryUuid(),
        priceMin: this.priceMin(),
        priceMax: this.priceMax(),
        sort: this.sort(),
      })
      .subscribe({
        next: (page) => {
          if (token !== this.requestToken) return;
          this.products.set(append ? [...this.products(), ...page.items] : page.items);
          this.nextCursor.set(page.meta.nextCursor);
          this.hasMore.set(page.meta.hasMore);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err) => {
          if (token !== this.requestToken) return;
          this.error.set(err?.message || 'Could not load products right now.');
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.fetchProducts(true);
  }

  setSort(sort: ProductSort): void {
    this.updateQuery({ sort: sort === 'newest' ? null : sort });
  }

  isPricePresetActive(preset: PricePreset): boolean {
    return this.priceMin() === preset.min && this.priceMax() === preset.max;
  }

  applyPricePreset(preset: PricePreset): void {
    const active = this.isPricePresetActive(preset);
    this.updateQuery({ priceMin: active ? null : preset.min, priceMax: active ? null : preset.max });
  }

  applyCustomPrice(): void {
    const min = this.priceMinInput.trim() ? Number(this.priceMinInput) : null;
    const max = this.priceMaxInput.trim() ? Number(this.priceMaxInput) : null;

    if ((min != null && Number.isNaN(min)) || (max != null && Number.isNaN(max)) || (min != null && min < 0) || (max != null && max < 0)) {
      this.priceError.set('Enter a valid price.');
      return;
    }
    if (min != null && max != null && min > max) {
      this.priceError.set('Minimum price must be less than or equal to maximum price.');
      return;
    }

    this.priceError.set(null);
    this.updateQuery({ priceMin: min, priceMax: max });
  }

  clearFilters(): void {
    this.priceError.set(null);
    this.updateQuery({ priceMin: null, priceMax: null, sort: null });
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  private updateQuery(patch: Record<string, string | number | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: patch, queryParamsHandling: 'merge' });
    this.closeFilters();
  }
}
