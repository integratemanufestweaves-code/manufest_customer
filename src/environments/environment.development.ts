/**
 * Local dev environment — points at manufest_be running via `npm run dev`
 * (default PORT=4000, see manufest_be/.env.example). Swap the host/port if
 * your local backend uses different values.
 *
 * Wired up via `angular.json`'s `build.development` `fileReplacements`
 * (added 2026-09-10) — `ng serve` and `ng build --configuration
 * development` both resolve `environments/environment` to this file.
 * Before that fix, this file was dead: nothing replaced `environment.ts`
 * in any build configuration, so every build (dev *and* production) used
 * the same file — see `environment.ts`'s own header comment for what that
 * broke. `manufest_seller` still has this gap open as of this writing;
 * don't copy its "not wired up" pattern into new apps.
 */
export const environment = {
  production: false,
  // apiBaseUrl: 'http://localhost:4000/api/v1',
  apiBaseUrl: 'https://manufestweaves.in/api/v1',
  csrfCookieName: 'XSRF-TOKEN',
  csrfHeaderName: 'X-XSRF-TOKEN',
  // Shows the "test environment / dummy products" notice (see
  // shared/test-mode-banner). Flip to false once this is the real,
  // official launch — that's the only change needed to remove it.
  showTestBanner: true,
};
