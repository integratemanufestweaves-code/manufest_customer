import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { BRAND_ASSETS } from '../../core/constants/brand-assets';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';

interface NavLink {
  label: string;
  /** Every nav destination today routes to the shared "coming soon" page —
   * see app.routes.ts. `path` is that route's path, `title`/`description`
   * become that route's `data.pageTitle`/`data.description`. None of these
   * are wired to a real category-browsing API yet (categories.api.js's
   * `GET /public/categories/list` exists and powers the Home page's "Shop
   * by Category" tiles, but a full filtered listing/browse page like the
   * design's "New Arrivals" screen is out of scope for this pass). */
  path: string;
  /** Key into the drawer template's `@switch` — same "icon key on the nav
   * item, inline SVG selected by a template switch" pattern
   * `manufest_seller/layout/sidebar/sidebar.component.*` uses for its own
   * nav, applied here for the mobile drawer only (see this component's
   * header comment for why the drawer specifically borrows that app's
   * pattern). */
  icon: 'new-arrivals' | 'origin' | 'fabric' | 'weave' | 'occasion';
}

/**
 * Storefront header — announcement bar + logo/nav/search/account row.
 * Matches `ui_design/Home Page.png` (desktop nav: New Arrivals / Origin /
 * Fabric / Weave / Occasion; mobile: hamburger + icon-only search/
 * wishlist/cart/account). Every interactive element other than the logo
 * (-> Home) and the mobile menu toggle routes to a "coming soon" page —
 * see app.routes.ts's routes.
 *
 * Mobile nav (redesigned 2026-09-10): was a plain list that expanded
 * inline below the header row, pushing page content down — replaced with
 * an off-canvas drawer + backdrop, directly modeled on
 * `manufest_seller/layout/{sidebar,seller-shell,topbar}.component.*`'s
 * mobile pattern (a fixed-position panel sliding in from the left,
 * `transform: translateX(...)`, a semi-transparent backdrop that closes it
 * on click, closing on every link tap). manufest_seller's version is
 * genuinely better mobile UX than what this app had — a slide-in panel
 * with a clear brand header and icon+label rows reads as "navigation",
 * where an inline-expanding list reads as an accordion — and since both
 * apps are the same product family, reusing the validated pattern instead
 * of re-deriving a worse one was the right call. Every manufest_* app
 * still styles its own components independently (no shared component
 * library between them), so this is a deliberate visual port, not an
 * import.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);

  readonly logoMark = BRAND_ASSETS.logoMark;
  readonly currentUser = this.auth.currentUser;
  readonly cartItemCount = this.cartService.itemCount;
  readonly wishlistItemCount = this.wishlistService.itemCount;

  readonly navLinks: NavLink[] = [
    { label: 'New Arrivals', path: '/new-arrivals', icon: 'new-arrivals' },
    { label: 'Origin', path: '/origin', icon: 'origin' },
    { label: 'Fabric', path: '/fabric', icon: 'fabric' },
    { label: 'Weave', path: '/weave', icon: 'weave' },
    { label: 'Occasion', path: '/occasion', icon: 'occasion' },
  ];

  readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
