import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Gates `/cart`, `/wishlist`, `/account` — all three require
 * `authenticateCustomer` server-side (`cart.api.js`/`wishlist.api.js`/
 * `users.api.js`'s `customerRouter`, every route). `AuthService.bootstrap()`
 * already runs at app startup (see `app.config.ts`'s `APP_INITIALIZER`),
 * so `isAuthenticated()` reflects a resolved session by the time any guard
 * runs — no extra network round-trip needed here, unlike
 * `manufest_seller`'s `sellerAuthGuard`, which calls `GET /me` itself
 * because that app has no equivalent startup probe.
 *
 * Redirects to `/login` with a `redirectTo` query param so the login page
 * can send the customer back to where they were headed.
 */
export const customerAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
};
