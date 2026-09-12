import { Routes } from '@angular/router';
import { customerAuthGuard } from './core/guards/customer-auth.guard';

/**
 * Route map for the customer-facing storefront.
 *
 * Real routes (backed by a live manufest_be API call), as of the 2026-09-12
 * auth/cart/wishlist/account/FAQ pass — see `CUSTOMER_APP_TODO.md` at the
 * repo root for the full audit this was built from: `''` (Home),
 * `product/:productUuid`, `new-arrivals`/`category/:categoryUuid`
 * (`ProductListingComponent`), `login`/`register`/`account` (`auth`/`users`
 * modules), `cart`/`wishlist` (`cart`/`wishlist` modules), `faq` (`faq`
 * module). `account`/`cart`/`wishlist` are gated by `customerAuthGuard`
 * since every route they call server-side requires `authenticateCustomer`.
 *
 * Still "coming soon" (`ComingSoonComponent`) — genuinely blocked, not just
 * unbuilt, per that same audit: `notifications`/`search` (no backend
 * endpoint at all), `origin`/`weave` (no matching attribute type exists in
 * `product_attributes_master`), `fabric`/`occasion` (attribute exists but
 * isn't exposed as a public list filter yet, or has no way to resolve a
 * uuid from this app), and everything under "footer" below (no backing
 * module, or out of this app's scope entirely).
 *
 * Adding real functionality later is additive: swap one of these entries'
 * `loadComponent` for a real feature component without touching any other
 * route.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'Manufest — Direct from manufacturer',
  },
  {
    path: 'product/:productUuid',
    loadComponent: () => import('./features/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
    title: 'Manufest — Product',
  },
  {
    path: 'new-arrivals',
    loadComponent: () => import('./features/product-listing/product-listing.component').then((m) => m.ProductListingComponent),
    title: 'Manufest — New Arrivals',
  },
  {
    path: 'category/:categoryUuid',
    loadComponent: () => import('./features/product-listing/product-listing.component').then((m) => m.ProductListingComponent),
    title: 'Manufest — Shop by Category',
  },

  // ---- account / auth ----
  // Backed by manufest_be's `auth` module (`/api/v1/auth/customer`) — see
  // CUSTOMER_APP_TODO.md's §1. `login`/`register` are public; `account` is
  // gated by `customerAuthGuard` (same as `cart`/`wishlist` below).
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Manufest — Sign in',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    title: 'Manufest — Create account',
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent),
    title: 'Manufest — My account',
    canActivate: [customerAuthGuard],
  },

  // ---- shopping ----
  // Backed by manufest_be's `cart`/`wishlist` modules — see
  // CUSTOMER_APP_TODO.md's §2/§3. Both require `authenticateCustomer` on
  // every route server-side, so both are gated here too.
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
    title: 'Manufest — Cart',
    canActivate: [customerAuthGuard],
  },
  {
    path: 'wishlist',
    loadComponent: () => import('./features/wishlist/wishlist.component').then((m) => m.WishlistComponent),
    title: 'Manufest — Wishlist',
    canActivate: [customerAuthGuard],
  },
  {
    path: 'notifications',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Notifications', description: 'Your notifications will show up here soon.' },
  },
  {
    path: 'search',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Search', description: 'Search is coming soon.' },
  },

  // ---- browse (nav bar) ----
  // 'new-arrivals' and 'category/:categoryUuid' are registered above as real
  // routes now that GET /public/products/list supports categoryUuid/
  // priceMin/priceMax/sort. Origin/Fabric/Weave stay "coming soon" below —
  // there's no public endpoint to browse by those attributes at all.
  {
    path: 'origin',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Shop by Origin', description: 'Browsing by weaving origin is coming soon.' },
  },
  {
    path: 'fabric',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Shop by Fabric', description: 'Browsing by fabric is coming soon.' },
  },
  {
    path: 'weave',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Shop by Weave', description: 'Browsing by weave is coming soon.' },
  },
  {
    path: 'occasion',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Shop by Occasion', description: 'Browsing by occasion is coming soon.' },
  },

  // ---- footer ----
  {
    path: 'sell-on-manufest',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Sell on Manufest',
      description: 'Manufacturer sign-up lives in a separate app (manufest_seller) — a link here is coming soon.',
    },
  },
  {
    path: 'manufacturers',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Our manufacturers', description: 'Verified manufacturer spotlights are coming soon.' },
  },
  {
    path: 'affiliates',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Affiliates & creators', description: 'This program is coming soon.' },
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/faq.component').then((m) => m.FaqComponent),
    title: "Manufest — FAQ's",
  },
  {
    path: 'help-center',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Help center', description: 'Our help center is coming soon.' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Privacy settings', description: 'Privacy settings are coming soon.' },
  },
  {
    path: 'social',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Follow us', description: 'Our social links are coming soon.' },
  },

  {
    path: '**',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Page not found', description: "This page doesn't exist yet." },
  },
];
