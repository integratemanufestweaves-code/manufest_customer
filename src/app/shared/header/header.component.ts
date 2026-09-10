import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BRAND_ASSETS } from '../../core/constants/brand-assets';

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
}

/**
 * Storefront header — announcement bar + logo/nav/search/account row.
 * Matches `design-reference/user/home/*.png` (desktop nav: New Arrivals /
 * Origin / Fabric / Weave / Occasion; mobile: hamburger + icon-only search/
 * wishlist/cart/account). Every interactive element other than the logo
 * (-> Home) and the mobile menu toggle routes to a "coming soon" page —
 * see app.routes.ts's routes.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly logoMark = BRAND_ASSETS.logoMark;

  readonly navLinks: NavLink[] = [
    { label: 'New Arrivals', path: '/new-arrivals' },
    { label: 'Origin', path: '/origin' },
    { label: 'Fabric', path: '/fabric' },
    { label: 'Weave', path: '/weave' },
    { label: 'Occasion', path: '/occasion' },
  ];

  readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
