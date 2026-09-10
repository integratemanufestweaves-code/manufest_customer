import { Routes } from '@angular/router';

/**
 * Route map for the customer-facing storefront.
 *
 * Only two routes are "real" (backed by a live manufest_be API call):
 * `''` (Home) and `product/:productUuid` (product detail). Every other
 * destination — anything needing customer auth, cart, wishlist,
 * notifications, or a full filtered product-browsing/search page — has no
 * corresponding manufest_be module yet (see manufest_be's own
 * `.claude/knowledge/01-overview.md` module list: no `orders`/`carts`/
 * `coupons`/etc. exist), so each just points at the shared
 * `ComingSoonComponent` with a route-specific title/description. This
 * mirrors manufest_seller's own `placeholder.component`/`data.pageTitle`
 * convention for exactly the same reason (see that repo's
 * `02-architecture-map.md`).
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

  // ---- account / auth ----
  {
    path: 'login',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Sign in', description: 'Customer login and registration are coming soon.' },
  },
  {
    path: 'register',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Create account', description: 'Customer registration is coming soon.' },
  },
  {
    path: 'account',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'My account', description: 'Your account, orders, and addresses will live here soon.' },
  },

  // ---- shopping ----
  {
    path: 'cart',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Cart', description: "Your cart is coming soon — we're building checkout next." },
  },
  {
    path: 'wishlist',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'Wishlist', description: 'Saving items to a wishlist is coming soon.' },
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
  {
    path: 'new-arrivals',
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: 'New Arrivals', description: 'The full, filterable product catalog is coming soon.' },
  },
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
    loadComponent: () => import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: { pageTitle: "FAQ's", description: 'Frequently asked questions are coming soon.' },
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
