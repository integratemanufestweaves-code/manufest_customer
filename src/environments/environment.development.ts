/**
 * Local dev environment — points at manufest_be running via `npm run dev`
 * (default PORT=4000, see manufest_be/.env.example). Swap the host/port if
 * your local backend uses different values. This file isn't wired up via
 * an Angular `fileReplacements` block in angular.json (manufest_seller's
 * isn't either — see that repo's own environments/ folder) — swap the
 * import in main.ts's bootstrap, or just edit environment.ts directly for
 * local testing, until a real dev/prod file-replacement build config is
 * set up for this app.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:4000/api/v1',
  csrfCookieName: 'XSRF-TOKEN',
  csrfHeaderName: 'X-XSRF-TOKEN',
};
