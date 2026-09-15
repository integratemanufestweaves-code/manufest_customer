import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const REFRESH_URL = `${environment.apiBaseUrl}/auth/customer/refresh`;

/** Shared across every request in flight so N concurrent 401s trigger one
 * refresh call, not N — module-level (not a class field) since functional
 * interceptors are plain functions, re-invoked per request. */
let refreshInFlight$: Observable<boolean> | null = null;

/**
 * manufest_be issues a short-lived `access_token_customer` cookie
 * (`JWT_ACCESS_TTL_SECONDS`) alongside a long-lived `refresh_token_customer`
 * one — but until now, nothing on this storefront ever called `POST
 * /auth/customer/refresh`. A customer who spent more than the access
 * token's lifetime browsing (easy on a long product-detail read, or just
 * an idle tab left open) would have their access-token cookie expire; the
 * next click — add to cart, place an order, anything — then 401'd with the
 * raw backend string "Missing access token" surfacing verbatim wherever
 * that component happened to render `err.message`, even though a
 * perfectly valid refresh token was sitting right there. Same bug
 * `manufest_seller`'s own `auth-refresh.interceptor.ts` already fixed on
 * that app (see its header comment) — this is the same fix, ported here.
 *
 * This retries the failed request exactly once, transparently, after
 * silently rotating the access token via the refresh cookie. Only a truly
 * dead session (refresh token itself missing/expired/revoked) falls
 * through to an actual "please log in" state.
 *
 * `authenticate.middleware.js`'s three failure throws (missing/invalid/
 * revoked access token) are the only ones that leave `AuthError`'s `code`
 * at its default `'UNAUTHENTICATED'` — every other 401 in this app (wrong
 * OTP, wrong password, ...) passes its own explicit code, so matching on
 * exactly `'UNAUTHENTICATED'` is how this avoids retrying unrelated 401s.
 *
 * Must be registered *before* `credentialsInterceptor` in `app.config.ts`
 * (earlier in the `withInterceptors([...])` array — interceptors run
 * request-order left-to-right). This interceptor forwards the *raw*
 * request to `next()` on both the first attempt and the retry, so each
 * pass goes through `credentialsInterceptor` fresh and picks up whatever
 * CSRF cookie is live in `document.cookie` at that moment — important
 * because `POST /refresh` also rotates the CSRF cookie, so the retried
 * request needs a freshly-read CSRF header, not the stale one from before
 * the refresh.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!req.url.startsWith(environment.apiBaseUrl) || req.url.startsWith(REFRESH_URL)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      const isExpiredAccessToken =
        err instanceof HttpErrorResponse && err.status === 401 && (err.error as { error?: { code?: string } })?.error?.code === 'UNAUTHENTICATED';

      if (!isExpiredAccessToken) {
        return throwError(() => err);
      }

      if (!refreshInFlight$) {
        refreshInFlight$ = authService.refresh().pipe(
          map(() => true),
          catchError(() => {
            // Refresh token itself is missing/expired/invalid — this is a
            // real "logged out" state, not a transient hiccup. Carries
            // `sessionExpired=1` (login.component.ts shows a "please log
            // in again" notice instead of a bare unexplained form) and
            // `redirectTo` (the same param a manual "please sign in" guard
            // redirect already uses) so login lands them back where they
            // were, not just at the homepage.
            authService.clearLocalSession();
            void router.navigate(['/login'], { queryParams: { sessionExpired: '1', redirectTo: router.url } });
            return of(false);
          }),
          shareReplay(1),
          finalize(() => {
            refreshInFlight$ = null;
          }),
        );
      }

      return refreshInFlight$.pipe(switchMap((refreshed) => (refreshed ? next(req) : throwError(() => err))));
    }),
  );
};
