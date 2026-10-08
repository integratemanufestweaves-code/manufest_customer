import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';

import { BRAND_ASSETS } from '../../core/constants/brand-assets';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProductService } from '../../core/services/product.service';
import { FACETS, FacetKey, PRICE_BANDS, ProductFilters, facetOptions } from '../../core/models/product-filters.models';

type NavKey = 'new-arrivals' | 'origin' | 'fabric' | 'weave' | 'occasion';

interface NavLink {
  label: string;
  /** Key into the drawer template's `@switch` for its icon, and into
   * `menus()` for its filter menu. */
  icon: NavKey;
}

interface MenuLink {
  label: string;
  commands: string[];
  queryParams?: Record<string, string | number>;
  /** Colour swatch, colour links only. */
  hex?: string;
}

interface MenuColumn {
  heading: string;
  links: MenuLink[];
  /** "+ N more" link (to the full product list, whose sidebar lists every
   * value) when the column was truncated. */
  more?: { count: number };
}

interface NavMenu {
  columns: MenuColumn[];
  viewAll: { label: string; commands: string[] };
}

interface SearchSuggestion {
  id: string;
  label: string;
  /** Right-aligned hint: "Fabric", "Category", the product's category… */
  hint: string;
  commands: string[];
  queryParams?: Record<string, string>;
}

/** Longest a mega-menu column gets before it links to its full page. */
const MENU_COLUMN_LIMIT = 10;
const SUGGESTION_TERM_LIMIT = 4;
const SUGGESTION_PRODUCT_LIMIT = 5;
const VIEW_ALL: NavMenu['viewAll'] = { label: 'View all products', commands: ['/shop'] };
const NEW_ARRIVALS_VIEW_ALL: NavMenu['viewAll'] = { label: 'See all new arrivals', commands: ['/new-arrivals'] };

/** Which nav menu's filters (see `menus`) the product-list query params
 * belong to, checked in nav order. */
const NAV_FACETS: Array<[NavKey, FacetKey[]]> = [
  ['origin', ['origin']],
  ['fabric', ['fabric', 'material', 'purity']],
  ['weave', ['weave', 'zariType', 'zariColor', 'border']],
  ['occasion', ['occasion', 'color']],
];

/** The nav item a URL belongs to: New Arrivals for `/new-arrivals` and
 * category pages (its Categories column), otherwise the menu whose filter
 * the product list has set. */
function navKeyForUrl(url: string, router: Router): NavKey | null {
  const tree = router.parseUrl(url);
  const path = tree.root.children['primary']?.segments[0]?.path;
  if (path === 'new-arrivals' || path === 'category') return 'new-arrivals';
  if (path !== 'shop') return null;
  return NAV_FACETS.find(([, facets]) => facets.some((f) => tree.queryParams[f]))?.[0] ?? null;
}

/**
 * Storefront header — announcement bar + logo/nav/search/account row.
 * Matches `ui_design/Home Page.png` (desktop nav: New Arrivals / Origin /
 * Fabric / Weave / Occasion; mobile: hamburger + icon-only search/
 * wishlist/cart/account).
 *
 * Nav filter menus (2026-10-01, modeled on Myntra's category menu): the
 * nav items aren't pages. Each opens a full-width panel of filter link
 * columns built from `GET /public/products/filters` (cached, see
 * `ProductService.getAllFiltersCached()`); every link opens the product
 * list (`/shop`, or `/new-arrivals` for that menu's price links) with that
 * filter set. Only values with live products are listed. Hovering previews
 * a menu; clicking pins it open until the next click outside the nav, a
 * click on another item (which switches to it), Escape, or following a
 * link. In the mobile drawer the same menus are accordion sections.
 *
 * Search (2026-10-01): submitting goes to `/search?q=` (the listing page
 * with `GET /public/products/list?q=`). While typing, a suggestion list
 * shows matching filter terms (from the cached `/filters`, e.g. "Organza ·
 * Fabric") and the first few matching products. Arrow keys move through
 * it, Enter opens the highlighted entry or runs the search, Escape closes.
 * On phones the header search is hidden; its icon opens `/search`, which
 * has its own search box.
 *
 * Mobile nav (redesigned 2026-09-10): was a plain list that expanded
 * inline below the header row, pushing page content down — replaced with
 * an off-canvas drawer + backdrop, directly modeled on
 * `manufest_seller/layout/{sidebar,seller-shell,topbar}.component.*`'s
 * mobile pattern (a fixed-position panel sliding in from the left,
 * `transform: translateX(...)`, a semi-transparent backdrop that closes it
 * on click, closing on every link tap). Every manufest_* app still styles
 * its own components independently (no shared component library between
 * them), so this is a deliberate visual port, not an import.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly notificationService = inject(NotificationService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly logoMark = BRAND_ASSETS.logoMark;
  readonly logoMarkSrcset = BRAND_ASSETS.logoMarkSrcset;
  readonly currentUser = this.auth.currentUser;
  readonly cartItemCount = this.cartService.itemCount;
  readonly wishlistItemCount = this.wishlistService.itemCount;
  readonly notificationUnreadCount = this.notificationService.unreadCount;

  readonly navLinks: NavLink[] = [
    { label: 'New Arrivals', icon: 'new-arrivals' },
    // Origin hidden 2026-10-05 (user request); re-add this line to bring it back.
    // { label: 'Origin', icon: 'origin' },
    { label: 'Fabric', icon: 'fabric' },
    { label: 'Weave', icon: 'weave' },
    { label: 'Occasion', icon: 'occasion' },
  ];

  readonly mobileMenuOpen = signal(false);
  /** The nav item the current page belongs to, kept highlighted. */
  readonly currentNav = signal<NavKey | null>(null);

  // --- mega menu -------------------------------------------------------------
  private readonly filters = signal<ProductFilters | null>(null);
  readonly openMenu = signal<NavKey | null>(null);
  /** Set by clicking a nav item: the menu stays open regardless of hover. */
  private readonly pinnedMenu = signal<NavKey | null>(null);
  /** Mobile drawer: which section's accordion is expanded. */
  readonly drawerSection = signal<NavKey | null>(null);
  private menuTimer: ReturnType<typeof setTimeout> | null = null;

  readonly menus = computed<Partial<Record<NavKey, NavMenu>>>(() => {
    const filters = this.filters();
    if (!filters) return {};
    const facetColumn = (heading: string, facet: FacetKey): MenuColumn => {
      const options = facetOptions(filters, facet).filter((o) => o.productCount > 0);
      return {
        heading,
        links: options.slice(0, MENU_COLUMN_LIMIT).map((o) => ({ label: o.name, commands: ['/shop'], queryParams: { [facet]: o.value }, hex: o.hex })),
        more: options.length > MENU_COLUMN_LIMIT ? { count: options.length - MENU_COLUMN_LIMIT } : undefined,
      };
    };
    const menu = (columns: MenuColumn[], viewAll: NavMenu['viewAll']): NavMenu => ({ columns: columns.filter((c) => c.links.length > 0), viewAll });

    return {
      'new-arrivals': menu(
        [
          {
            heading: 'Categories',
            links: filters.categories.filter((c) => c.productCount > 0).map((c) => ({ label: c.name, commands: ['/category', c.uuid] })),
          },
          {
            heading: 'Shop by Price',
            links: PRICE_BANDS.map((band) => ({
              label: band.label,
              commands: ['/new-arrivals'],
              queryParams: { ...(band.min != null ? { priceMin: band.min } : {}), ...(band.max != null ? { priceMax: band.max } : {}) },
            })),
          },
        ],
        NEW_ARRIVALS_VIEW_ALL,
      ),
      origin: menu([facetColumn('Districts', 'origin')], VIEW_ALL),
      fabric: menu([facetColumn('Blended & Specialty', 'fabric'), facetColumn('Material', 'material'), facetColumn('Fabric Purity', 'purity')], VIEW_ALL),
      weave: menu(
        [facetColumn('Weaving Technique', 'weave'), facetColumn('Zari Type', 'zariType'), facetColumn('Zari Colour', 'zariColor'), facetColumn('Border Type', 'border')],
        VIEW_ALL,
      ),
      occasion: menu([facetColumn('Occasion', 'occasion'), facetColumn('Popular Colours', 'color')], VIEW_ALL),
    };
  });

  readonly activeMenu = computed(() => {
    const key = this.openMenu();
    return key ? { key, menu: this.menuFor(key) } : null;
  });

  /** Falls back to just the "view all" link while `/filters` is loading or
   * if it failed, so opening a menu always offers somewhere to go. */
  menuFor(key: NavKey): NavMenu {
    return this.menus()[key] ?? { columns: [], viewAll: key === 'new-arrivals' ? NEW_ARRIVALS_VIEW_ALL : VIEW_ALL };
  }

  // --- search ---------------------------------------------------------------
  searchText = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly productSuggestions = signal<SearchSuggestion[]>([]);
  private readonly typedText = signal('');
  readonly suggestionsOpen = signal(false);
  readonly activeSuggestion = signal(-1);

  readonly suggestions = computed<SearchSuggestion[]>(() => {
    const text = this.typedText().trim().toLowerCase();
    const filters = this.filters();
    if (text.length < 2) return [];
    const terms: SearchSuggestion[] = [];
    if (filters) {
      filters.categories
        .filter((c) => c.productCount > 0 && c.name.toLowerCase().includes(text))
        .forEach((c) => terms.push({ id: `cat-${c.uuid}`, label: c.name, hint: 'Category', commands: ['/category', c.uuid] }));
      FACETS.forEach(({ facet, label }) => {
        facetOptions(filters, facet)
          .filter((o) => o.productCount > 0 && o.name.toLowerCase().includes(text))
          .forEach((o) => terms.push({ id: `${facet}-${o.value}`, label: o.name, hint: label, commands: ['/shop'], queryParams: { [facet]: o.value } }));
      });
    }
    return [...terms.slice(0, SUGGESTION_TERM_LIMIT), ...this.productSuggestions()];
  });

  ngOnInit(): void {
    this.productService
      .getAllFiltersCached()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (filters) => this.filters.set(filters), error: () => this.filters.set(null) });

    this.searchInput$
      .pipe(
        map((text) => text.trim()),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((text) =>
          text.length < 2
            ? of([])
            : this.productService.listProducts({ q: text, limit: SUGGESTION_PRODUCT_LIMIT }).pipe(
                map((page) =>
                  page.items.map<SearchSuggestion>((p) => ({ id: `p-${p.uuid}`, label: p.productName, hint: p.category?.name ?? 'Product', commands: ['/product', p.uuid] })),
                ),
                catchError(() => of([])),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => this.productSuggestions.set(items));

    // Keep the box in sync with the current search; empty it elsewhere.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const tree = this.router.parseUrl(this.router.url);
        const onSearch = tree.root.children['primary']?.segments[0]?.path === 'search';
        this.searchText = onSearch ? (tree.queryParams['q'] ?? '') : '';
        this.currentNav.set(navKeyForUrl(this.router.url, this.router));
        this.closeSuggestions();
        this.closeMenuNow();
      });
    this.currentNav.set(navKeyForUrl(this.router.url, this.router));
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    this.drawerSection.set(null);
  }

  // Hover preview, with small open/close delays so moving the pointer
  // diagonally from the nav item down into its panel (or brushing past an
  // item) doesn't flicker. Ignored while a menu is pinned by a click.
  scheduleMenu(key: NavKey | null): void {
    if (this.pinnedMenu()) return;
    if (this.menuTimer) clearTimeout(this.menuTimer);
    this.menuTimer = setTimeout(() => this.openMenu.set(key), key ? 120 : 160);
  }

  /** Click on a nav item: pin its menu open, switch to it from another
   * pinned menu, or close it if it's the one already pinned. */
  toggleMenu(key: NavKey): void {
    if (this.menuTimer) clearTimeout(this.menuTimer);
    const close = this.pinnedMenu() === key;
    this.pinnedMenu.set(close ? null : key);
    this.openMenu.set(close ? null : key);
  }

  closeMenuNow(): void {
    if (this.menuTimer) clearTimeout(this.menuTimer);
    this.pinnedMenu.set(null);
    this.openMenu.set(null);
  }

  /** Any click outside the nav (items and their panels) closes the menu. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu()) return;
    const target = event.target as Element | null;
    if (!target?.closest('.header__nav')) this.closeMenuNow();
  }

  /** Keyboard: close once focus moves to something outside the nav item and
   * its panel. A mouse click on blank panel space blurs with no
   * `relatedTarget`, so that alone never closes it. */
  onMenuFocusOut(event: FocusEvent, item: HTMLElement): void {
    const next = event.relatedTarget as Node | null;
    if (next && !item.contains(next)) this.closeMenuNow();
  }

  toggleDrawerSection(key: NavKey): void {
    this.drawerSection.update((open) => (open === key ? null : key));
  }

  onSearchInput(text: string): void {
    this.typedText.set(text);
    this.activeSuggestion.set(-1);
    this.suggestionsOpen.set(true);
    this.searchInput$.next(text);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.suggestionsOpen.set(true);
      this.activeSuggestion.set((this.activeSuggestion() + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeSuggestion.set((this.activeSuggestion() - 1 + count) % count);
    } else if (event.key === 'Escape' && this.suggestionsOpen() && count) {
      // First Escape just closes the list; without preventDefault the
      // browser's native search-input behavior would also wipe the text.
      event.preventDefault();
      this.closeSuggestions();
    }
  }

  submitSearch(): void {
    const active = this.suggestionsOpen() ? this.suggestions()[this.activeSuggestion()] : undefined;
    if (active) {
      this.openSuggestion(active);
      return;
    }
    const q = this.searchText.trim();
    if (!q) return;
    this.closeSuggestions();
    this.router.navigate(['/search'], { queryParams: { q } });
  }

  openSuggestion(suggestion: SearchSuggestion): void {
    this.closeSuggestions();
    this.router.navigate(suggestion.commands, { queryParams: suggestion.queryParams ?? {} });
  }

  closeSuggestions(): void {
    this.suggestionsOpen.set(false);
    this.activeSuggestion.set(-1);
  }

  /** Blur fires before a suggestion's click; suggestions use `mousedown`
   * with preventDefault so the input keeps focus, and this closes the list
   * only when focus genuinely leaves the search. */
  onSearchFocusOut(event: FocusEvent, container: HTMLElement): void {
    if (!container.contains(event.relatedTarget as Node | null)) this.closeSuggestions();
  }
}
