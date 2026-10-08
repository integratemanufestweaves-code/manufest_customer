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
   * pairs this with its own "Manufest Weaves" text next to it). Reuses the
   * same transparent-background asset as `favicon` below — the old
   * `Logo-light-without-title.png` had an opaque white square baked in
   * behind the mark (confirmed by inspecting its pixels: every corner was
   * solid white, not alpha 0), which showed as a visible white box on any
   * non-white background.
   *
   * PNGs, not the SVG (2026-10-08): `Manufest-Weaves-icon-nobg.svg` is only a
   * 650 KB wrapper around a 2176px PNG drawn through an SVG <pattern>, which
   * browsers (iOS Safari especially) rasterize soft — the logo looked blurry
   * on every screen. These are that same artwork, cropped and downsampled
   * once, offline. Pair `logoMark` with `logoMarkSrcset` + a `sizes` of the
   * rendered CSS width so each screen density gets an exact-size image. */
  logoMark: 'assets/logo/manufest-weaves-mark-192.png',
  logoMarkSrcset:
    'assets/logo/manufest-weaves-mark-32.png 32w, assets/logo/manufest-weaves-mark-64.png 64w, ' +
    'assets/logo/manufest-weaves-mark-96.png 96w, assets/logo/manufest-weaves-mark-192.png 192w',
  /** Transparent-background icon mark used for the browser-tab favicon
   * (`index.html`'s `<link rel="icon">`). Not usable via an Angular binding
   * — index.html loads before Angular bootstraps — so this is a
   * source-of-truth reference only; the `<link>` tag must be updated by
   * hand to match if this path ever changes. */
  favicon: 'assets/logo/manufest-weaves-mark-32.png',
} as const;
