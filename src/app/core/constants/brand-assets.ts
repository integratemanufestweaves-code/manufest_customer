/**
 * Single source of truth for static brand asset paths — same convention as
 * manufest_seller's core/constants/brand-assets.ts (the image-file
 * equivalent of how styles.scss centralizes color tokens as CSS custom
 * properties): change the path here once, every component that renders the
 * logo picks it up. Paths are relative to the app's asset root — this app
 * copies static files from `public/` (angular.json's newer `assets` config)
 * rather than `src/assets`, so the logo lives at `public/assets/logo/...`
 * to keep the same `assets/logo/...` path convention as manufest_seller and
 * manufest_admin. The asset file itself is copied over from
 * manufest_seller unchanged — same brand, same logo, no separate storefront
 * visual identity.
 */
export const BRAND_ASSETS = {
  /** Boxed logo mark, no wordmark baked in — use anywhere the brand name is
   * already rendered as its own text label nearby (the storefront header
   * pairs this with its own "Manufest" text next to it). */
  logoMark: 'assets/logo/Logo-light-without-title.png',
  /** Transparent-background icon mark used for the browser-tab favicon
   * (`index.html`'s `<link rel="icon">`). Not usable via an Angular binding
   * — index.html loads before Angular bootstraps — so this is a
   * source-of-truth reference only; the `<link>` tag must be updated by
   * hand to match if this path ever changes. */
  favicon: 'assets/logo/Manufest-Weaves-icon-nobg.svg',
} as const;
