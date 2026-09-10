import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Reads a single cookie by name via `document.cookie` — this app is
 * browser-only (no SSR), so `document` is always available here.
 */
function readCookie(name: string): string | null {
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Same shape as manufest_seller's `credentials.interceptor.ts` — see that
 * file's header comment for the full rationale (Angular's built-in XSRF
 * handling never fires for an absolute cross-origin API URL, so the CSRF
 * double-submit header is attached by hand here too).
 *
 * Nothing in this app calls an authenticated route yet — every request
 * made by manufest_customer today is a public GET (`/public/products/*`,
 * `/public/categories/*`) that manufest_be's CORS/CSRF layer doesn't gate
 * at all. This interceptor is wired in from day one anyway, matching the
 * security convention every other manufest_* frontend already follows
 * (manufest_be's `.claude/knowledge/12-identity-split.md` — cookie auth +
 * CSRF double-submit, `withCredentials` on same-origin-audience calls) —
 * so that the moment customer login/cart/wishlist/etc. land on real
 * `authenticateCustomer`-gated routes, this file doesn't need to change at
 * all, and no engineer is tempted to bolt on `withCredentials: true`
 * ad hoc at a single call site instead of centrally here.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  let cloned = req.clone({ withCredentials: true });

  if (!SAFE_METHODS.has(req.method)) {
    const csrfToken = readCookie(environment.csrfCookieName);
    if (csrfToken) {
      cloned = cloned.clone({ setHeaders: { [environment.csrfHeaderName]: csrfToken } });
    }
  }

  return next(cloned);
};
