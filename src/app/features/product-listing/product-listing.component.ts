import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { ListProductsOptions, ProductService, ProductSort } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductSummary } from '../../core/models/product.models';
import { FACETS, FacetDefinition, FacetKey, FacetOption, PRICE_BANDS, PriceBand, ProductFilters, facetOptions, priceRangeLabel } from '../../core/models/product-filters.models';

interface SingleOption<T> {
  value: T;
  label: string;
  productCount?: number;
}

interface FacetGroup {
  definition: FacetDefinition;
  options: FacetOption[];
  /** Options beyond the collapsed limit (0 when expanded or short). */
  hiddenCount: number;
}

/** One block of the sidebar, in display order (matches the design mock). */
type SidebarSection = { kind: 'category' } | { kind: 'price' } | { kind: 'discount' } | { kind: 'blouse' } | { kind: 'facet'; group: FacetGroup };

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

type BlouseFilter = 'with' | 'without';
type FacetSelection = Record<FacetKey, string[]>;

const emptySelection = (): FacetSelection => Object.fromEntries(FACETS.map((f) => [f.facet, []])) as unknown as FacetSelection;

const SORT_VALUES: ProductSort[] = ['newest', 'oldest', 'price_asc', 'price_desc'];

/** Groups longer than this collapse behind a "+ N more" toggle. */
const COLLAPSED_OPTION_LIMIT = 5;

/**
 * Real, filterable product browsing page. Serves four routes that only
 * differ in their defaults: `/new-arrivals` (no category — "new arrivals"
 * is itself just `sort=newest`, the API's default), `/shop` (the general
 * listing every header menu links into), `/search?q=`
 * (the header search) and `/category/:categoryUuid` (Home's "Shop by
 * Category" tiles, and the sidebar's Category group). `q` is honored on
 * every route, and "Clear all" keeps it, since the search is the page's
 * context rather than one of its filters.
 *
 * Sidebar follows the design mock (`ui_design/View all.png`): Category,
 * Brand, Price, Colours, Discount, Blouse, Fabric Purity, Material, Zari
 * Colour, Zari Type, Border Type, Occasion, plus Fabric/Weave/Origin (the
 * nav bar's browse facets). Options and counts come from
 * `GET /public/products/filters`, scoped to the pinned category when there
 * is one; options with no products are hidden unless selected, and a group
 * with nothing to offer is hidden entirely (e.g. Discount while no variant
 * is discounted). The mock's extra Blouse values (stitched, semi-fabric,
 * contrast…) have no backing data, so Blouse is just with/without.
 *
 * All filter state lives in the URL so a filtered page can be shared or
 * reloaded: one param per facet (`?fabric=<uuid>,<uuid>&color=maroon`,
 * see `FacetKey`), plus `blouse`, `discount`, `priceMin`/`priceMax` and
 * `sort`. Multi-select values OR within a group and AND across groups,
 * same as `GET /public/products/list` does server-side.
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

  readonly priceOptions = PRICE_BANDS;

  readonly sortOptions: Array<{ value: ProductSort; label: string }> = [
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'oldest', label: 'Oldest' },
  ];

  /** `/new-arrivals` keeps its own heading; `/shop` is the generic one. */
  private readonly isNewArrivals = this.route.snapshot.routeConfig?.path === 'new-arrivals';
  readonly isSearch = this.route.snapshot.routeConfig?.path === 'search';

  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly hasMore = signal(false);

  readonly searchQuery = signal<string | null>(null);
  /** The on-page search box (mobile only — the header has one on desktop). */
  searchInput = '';
  readonly categoryUuid = signal<string | null>(null);
  readonly categoryName = signal<string | null>(null);
  readonly sort = signal<ProductSort>('newest');
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);
  readonly blouse = signal<BlouseFilter | null>(null);
  readonly discountMin = signal<number | null>(null);
  readonly selection = signal<FacetSelection>(emptySelection());

  /** `null` until loaded (or if it failed — the sidebar then falls back to
   * just the price filter, and chips show generic labels). */
  readonly filters = signal<ProductFilters | null>(null);

  readonly filtersOpen = signal(false);
  readonly expandedGroups = signal<Set<FacetKey>>(new Set());

  readonly categoryOptions = computed(() => (this.filters()?.categories ?? []).filter((c) => c.productCount > 0 || c.uuid === this.categoryUuid()));

  readonly discountOptions = computed<SingleOption<number>[]>(() =>
    (this.filters()?.discounts ?? [])
      .filter((d) => d.productCount > 0 || d.min === this.discountMin())
      .map((d) => ({ value: d.min, label: `${d.min}% and above`, productCount: d.productCount })),
  );

  readonly blouseOptions = computed<SingleOption<BlouseFilter>[]>(() => {
    const counts = this.filters()?.blouse;
    if (!counts) return [];
    const options: SingleOption<BlouseFilter>[] = [
      { value: 'with', label: 'With blouse piece', productCount: counts.with },
      { value: 'without', label: 'Without blouse piece', productCount: counts.without },
    ];
    return options.filter((o) => o.productCount! > 0 || o.value === this.blouse());
  });

  readonly sections = computed<SidebarSection[]>(() => {
    const filters = this.filters();
    const selection = this.selection();
    const expanded = this.expandedGroups();
    const groups = new Map<FacetKey, FacetGroup>();
    if (filters) {
      FACETS.forEach((definition) => {
        const selected = selection[definition.facet];
        const all = facetOptions(filters, definition.facet).filter((o) => o.productCount > 0 || selected.includes(o.value));
        if (!all.length) return;
        const collapse = !expanded.has(definition.facet) && all.length > COLLAPSED_OPTION_LIMIT + 1;
        // Selected options stay visible even when their group is collapsed.
        const options = collapse ? all.filter((o, i) => i < COLLAPSED_OPTION_LIMIT || selected.includes(o.value)) : all;
        groups.set(definition.facet, { definition, options, hiddenCount: all.length - options.length });
      });
    }
    const facet = (key: FacetKey): SidebarSection[] => (groups.has(key) ? [{ kind: 'facet', group: groups.get(key)! }] : []);

    return [
      ...(this.categoryOptions().length > 1 ? [{ kind: 'category' } as const] : []),
      ...facet('brand'),
      { kind: 'price' } as const,
      ...facet('color'),
      ...(this.discountOptions().length ? [{ kind: 'discount' } as const] : []),
      ...(this.blouseOptions().length ? [{ kind: 'blouse' } as const] : []),
      // 'origin' hidden 2026-10-05 (user request); add it back to this list to restore the filter.
      ...(['purity', 'material', 'zariColor', 'zariType', 'border', 'occasion', 'fabric', 'weave'] as FacetKey[]).flatMap(facet),
    ];
  });

  /** Set when exactly one facet value is selected and nothing else in any
   * facet, e.g. the user arrived from a header menu link. Drives the
   * heading and the breadcrumb's middle crumb. */
  readonly singleFacet = computed<{ label: string; name: string } | null>(() => {
    const selection = this.selection();
    const active = FACETS.filter((d) => selection[d.facet].length > 0);
    if (active.length !== 1 || selection[active[0].facet].length !== 1) return null;
    const definition = active[0];
    return { label: definition.label, name: this.optionName(definition.facet, selection[definition.facet][0]) };
  });

  readonly heading = computed(() => {
    const q = this.searchQuery();
    if (q) return `Results for “${q}”`;
    if (this.isSearch) return 'Search';
    return this.categoryName() ?? this.singleFacet()?.name ?? (this.isNewArrivals ? 'New Arrivals' : 'All Products');
  });

  readonly activeChips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const q = this.searchQuery();
    if (q) chips.push({ key: 'q', label: `Search: ${q}`, remove: () => this.updateQuery({ q: null }) });
    const selection = this.selection();
    FACETS.forEach(({ facet, label }) => {
      selection[facet].forEach((value) => {
        chips.push({ key: `${facet}:${value}`, label: `${label}: ${this.optionName(facet, value)}`, remove: () => this.toggleFacet(facet, value) });
      });
    });
    const min = this.priceMin();
    const max = this.priceMax();
    if (min != null || max != null) {
      chips.push({ key: 'price', label: `Price: ${priceRangeLabel(min, max)}`, remove: () => this.updateQuery({ priceMin: null, priceMax: null }) });
    }
    const discount = this.discountMin();
    if (discount != null) {
      chips.push({ key: 'discount', label: `Discount: ${discount}% and above`, remove: () => this.updateQuery({ discount: null }) });
    }
    const blouse = this.blouse();
    if (blouse) {
      chips.push({ key: 'blouse', label: blouse === 'with' ? 'With blouse piece' : 'Without blouse piece', remove: () => this.updateQuery({ blouse: null }) });
    }
    return chips;
  });

  /** Excludes the search chip — "Clear all" keeps the search, so it
   * shouldn't count toward (or be the only reason to show) it. */
  readonly activeFilterCount = computed(() => this.activeChips().filter((c) => c.key !== 'q').length);
  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0 || this.sort() !== 'newest');

  private requestToken = 0;
  private filtersLoadedFor: string | null | undefined = undefined;

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        const categoryUuid = params.get('categoryUuid');
        const categoryChanged = categoryUuid !== this.categoryUuid();
        this.categoryUuid.set(categoryUuid);

        const q = (query.get('q') ?? '').trim();
        this.searchQuery.set(q || null);
        this.searchInput = q;

        const sort = query.get('sort') as ProductSort | null;
        this.sort.set(sort && SORT_VALUES.includes(sort) ? sort : 'newest');
        this.priceMin.set(toNumber(query.get('priceMin')));
        this.priceMax.set(toNumber(query.get('priceMax')));
        this.discountMin.set(toNumber(query.get('discount')));
        const blouse = query.get('blouse');
        this.blouse.set(blouse === 'with' || blouse === 'without' ? blouse : null);

        const selection = emptySelection();
        FACETS.forEach(({ facet }) => {
          selection[facet] = (query.get(facet) ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        });
        this.selection.set(selection);

        if (categoryChanged) {
          this.categoryName.set(null);
          if (categoryUuid) {
            this.categoryService.getCategory(categoryUuid).subscribe({
              next: (cat) => this.categoryName.set(cat.name),
              error: () => this.categoryName.set(null),
            });
          }
        }
        this.loadFilters(categoryUuid);

        this.fetchProducts(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFilters(categoryUuid: string | null): void {
    if (this.filtersLoadedFor === categoryUuid) return;
    this.filtersLoadedFor = categoryUuid;
    this.productService.getFilters(categoryUuid).subscribe({
      next: (filters) => {
        if (this.filtersLoadedFor === categoryUuid) this.filters.set(filters);
      },
      error: () => {
        if (this.filtersLoadedFor !== categoryUuid) return;
        this.filters.set(null);
        this.filtersLoadedFor = undefined;
      },
    });
  }

  private fetchProducts(append: boolean): void {
    const token = ++this.requestToken;
    if (!append) {
      this.loading.set(true);
      this.products.set([]);
    }
    this.error.set(null);

    const selection = this.selection();
    const opts: ListProductsOptions = {
      limit: 20,
      cursor: append ? this.nextCursor() : null,
      categoryUuid: this.categoryUuid(),
      q: this.searchQuery(),
      priceMin: this.priceMin(),
      priceMax: this.priceMax(),
      blouse: this.blouse(),
      discountMin: this.discountMin(),
      sort: this.sort(),
    };
    FACETS.forEach(({ facet, apiKey }) => (opts[apiKey] = selection[facet]));

    this.productService.listProducts(opts).subscribe({
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

  /** Display name for a selected value; falls back to a readable form of
   * the raw value until `/filters` has loaded (or if it no longer exists). */
  private optionName(facet: FacetKey, value: string): string {
    const filters = this.filters();
    const match = filters ? facetOptions(filters, facet).find((o) => o.value === value) : undefined;
    if (match) return match.name;
    return facet === 'origin' || facet === 'color' ? value.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : 'Selected';
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.fetchProducts(true);
  }

  submitSearch(): void {
    this.updateQuery({ q: this.searchInput.trim() || null });
  }

  setSort(sort: ProductSort): void {
    this.updateQuery({ sort: sort === 'newest' ? null : sort });
  }

  isSelected(facet: FacetKey, value: string): boolean {
    return this.selection()[facet].includes(value);
  }

  /** Checkbox toggle — keeps the mobile drawer open so several filters can
   * be picked in one go (it has its own "Show results" button). */
  toggleFacet(facet: FacetKey, value: string): void {
    const current = this.selection()[facet];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.updateQuery({ [facet]: next.length ? next.join(',') : null }, false);
  }

  toggleExpanded(facet: FacetKey): void {
    const next = new Set(this.expandedGroups());
    if (next.has(facet)) next.delete(facet);
    else next.add(facet);
    this.expandedGroups.set(next);
  }

  /** Category is a route segment, not a query param — switching it keeps
   * every other filter via `queryParamsHandling: 'preserve'`. */
  selectCategory(categoryUuid: string | null): void {
    if (categoryUuid === this.categoryUuid()) return;
    this.router.navigate(categoryUuid ? ['/category', categoryUuid] : ['/shop'], { queryParamsHandling: 'preserve' });
  }

  isPriceActive(band: PriceBand): boolean {
    return this.priceMin() === band.min && this.priceMax() === band.max;
  }

  /** Single-select groups (price, discount, blouse) render as radios;
   * clicking the already-selected one clears it. */
  togglePrice(band: PriceBand): void {
    const active = this.isPriceActive(band);
    this.updateQuery({ priceMin: active ? null : band.min, priceMax: active ? null : band.max }, false);
  }

  toggleDiscount(min: number): void {
    this.updateQuery({ discount: this.discountMin() === min ? null : min }, false);
  }

  toggleBlouse(value: BlouseFilter): void {
    this.updateQuery({ blouse: this.blouse() === value ? null : value }, false);
  }

  clearFilters(): void {
    const patch: Record<string, null> = { priceMin: null, priceMax: null, sort: null, blouse: null, discount: null };
    FACETS.forEach(({ facet }) => (patch[facet] = null));
    this.updateQuery(patch, false);
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  private updateQuery(patch: Record<string, string | number | null>, closeDrawer = true): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: patch, queryParamsHandling: 'merge' });
    if (closeDrawer) this.closeFilters();
  }
}

function toNumber(value: string | null): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
