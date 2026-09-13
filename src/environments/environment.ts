/**
 * Production environment values. `apiBaseUrl` must match manufest_be's
 * mount prefix (`/api/v1`, see manufest_be/src/routes/index.js) on whatever
 * host the API is deployed to. `credentials.interceptor.ts` is wired the
 * same way manufest_seller's is (cookie auth + CSRF double-submit header),
 * ready for when customer auth/cart/wishlist land on real routes.
 *
 * 2026-09-10: this file previously pointed at `http://localhost:4000` with
 * the real HTTPS URL commented out, and `angular.json` had no
 * `fileReplacements` swapping it for `environment.development.ts` in any
 * build configuration — meaning *every* build, `ng serve` included, always
 * used this same file, and a `ng build --configuration production` would
 * have shipped `http://localhost:4000` (unreachable, and plain HTTP) to
 * real users. Fixed by wiring `fileReplacements` into `angular.json`'s
 * `build.development` configuration (so `ng serve`/dev builds now use
 * `environment.development.ts`'s `localhost:4000` instead) and restoring
 * the real HTTPS endpoint here — this is the file every other build
 * configuration actually ships. This app is a public, unauthenticated
 * storefront that "anyone" reaches directly, so serving it over plain HTTP
 * in production was a real regression, not just a broken link: no
 * transport encryption for API calls, and `credentials.interceptor.ts`'s
 * CSRF cookie has no `Secure` guarantee to rely on over HTTP.
 */
export const environment = {
  production: true,
  // apiBaseUrl: 'http://localhost:4000/api/v1',
  apiBaseUrl: 'https://manufestweaves.in/api/v1',
  csrfCookieName: 'XSRF-TOKEN',
  csrfHeaderName: 'X-XSRF-TOKEN',
  // Shows the "test environment / dummy products" notice (see
  // shared/test-mode-banner). Flip to false once this is the real,
  // official launch — that's the only change needed to remove it.
  showTestBanner: true,
};
