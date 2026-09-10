/**
 * Production environment values. `apiBaseUrl` must match manufest_be's
 * mount prefix (`/api/v1`, see manufest_be/src/routes/index.js) on whatever
 * host the API is deployed to. Only public, unauthenticated GET endpoints
 * are called by this app today (see core/services/*) — no login exists yet
 * in this app, so there is nothing here that needs a CSRF cookie name, but
 * `credentials.interceptor.ts` is already wired the same way
 * manufest_seller's is, ready for when customer auth is added.
 */
export const environment = {
  production: true,
  // apiBaseUrl: 'https://manufestweaves.in/api/v1',
  apiBaseUrl: 'http://localhost:4000/api/v1',
  csrfCookieName: 'XSRF-TOKEN',
  csrfHeaderName: 'X-XSRF-TOKEN',
};
