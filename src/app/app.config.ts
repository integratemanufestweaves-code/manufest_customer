import { APP_INITIALIZER, ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { WishlistService } from './core/services/wishlist.service';
import { NotificationService } from './core/services/notification.service';

/**
 * Resolves whether a returning visitor already has a valid session cookie
 * *before* the app renders anything auth-dependent (header sign-in state,
 * `customerAuthGuard` on cart/wishlist/account) — without this, the header
 * would flash "Sign in" on every reload even for an already-logged-in
 * customer, and a guarded route would bounce a valid session to /login
 * before `AuthService.me()` had a chance to resolve. `AuthService.bootstrap()`
 * never throws (it resolves to `null` on failure), so this can't block app
 * startup on a network hiccup.
 *
 * Also seeds the header's cart/wishlist/notification badges for a
 * returning logged-in visitor — without this, a reload would show empty
 * badges until the customer happened to open that page themselves (each
 * calls its own `refresh()` in `ngOnInit`, but nothing else did until now).
 */
function initAuthSession() {
  const auth = inject(AuthService);
  const cart = inject(CartService);
  const wishlist = inject(WishlistService);
  const notifications = inject(NotificationService);
  return () =>
    firstValueFrom(auth.bootstrap()).then((profile) => {
      if (profile) {
        cart.refresh();
        wishlist.refresh();
        notifications.refreshUnreadCount();
      }
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Without this, Angular's Router leaves `window.scroll` untouched on
    // navigation — it doesn't jump to the top of the new page by default,
    // only browser back/forward gets any scroll handling at all. Scrolled
    // partway down a long page (e.g. "Shop by category"), then clicking a
    // product/category link, the next page loads at that *same* scroll
    // offset instead of from the top — on a shorter page that offset can
    // already be past the content and into the footer, which is exactly
    // what looked like "clicking anything jumps to the footer." `top`
    // resets to (0,0) on every new navigation; `anchorScrolling` still lets
    // an in-page `#fragment` link scroll to that element instead.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    // Order matters: authRefreshInterceptor must run before
    // credentialsInterceptor (see its own header comment) — interceptors
    // execute request-order left-to-right, and the retried request needs
    // to pass through credentialsInterceptor *again*, fresh, to pick up
    // the CSRF cookie POST /refresh just rotated.
    provideHttpClient(withInterceptors([authRefreshInterceptor, credentialsInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initAuthSession, multi: true },
  ],
};
