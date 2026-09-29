import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ApplicationAssetService } from '../../core/services/application-asset.service';
import { ActiveAssetSet, ApplicationAsset, AssetBreakpoint } from '../../core/models/application-asset.models';

const AUTO_ADVANCE_MS = 6000;
/** How often an open tab re-checks `/active` for a changed banner set —
 * 15 minutes in production, 10 seconds under `ng serve` for testing (see
 * the environment files). */
export const BANNER_POLL_MS = environment.bannerPollMs;

/**
 * Admin-managed, responsive banner slot — replaces what used to be
 * home.component.html's hardcoded "Christmas Sale" hero markup. Fetches
 * `GET /public/application-assets/active?placementKey=...`
 * (ApplicationAssetService) and renders whichever assets are currently
 * live for that slot as a `<picture>` per asset (mobile/tablet/laptop
 * breakpoint-specific `<source>`s, falling back to the 'default' image for
 * any breakpoint the admin didn't upload a specific crop for — see
 * `srcFor()`). More than one live asset renders as a lightweight
 * auto-advancing crossfade carousel with dot navigation (plain
 * signal + `setInterval`, no carousel library) — several assets can be
 * active for the same placement at once by design (a rotating set of
 * festival banners), see applicationAssets.api.js's header comment.
 *
 * Loading/refresh cycle:
 * 1. Render the last set seen on this device straight from localStorage
 *    (ApplicationAssetService#readCachedSet) — no wait on the network for
 *    a repeat visitor. Images are served from the browser's HTTP cache
 *    (`/media` is `immutable`), so they aren't re-downloaded either.
 * 2. Fetch `/active` and compare its `version` to what's on screen. Same
 *    version → nothing happens. Different → preload the new images for
 *    the current screen size, then swap and re-cache.
 * 3. Repeat step 2 every BANNER_POLL_MS while the tab is visible (and
 *    immediately on returning to a tab whose last check is overdue), so a
 *    banner the admin activates reaches open tabs without a reload.
 *
 * Deliberately generic on `placementKey` (and optional `category`) rather
 * than hardcoded to the homepage hero — a future logo/favicon/secondary-
 * banner placement reuses this exact component with a different input,
 * no new component needed (see manufest_be's applicationAssets.api.js
 * header comment for the matching backend-side generality).
 *
 * Emits `assetsLoaded` whenever it learns whether there is anything to
 * show (from cache, the first fetch, or a later poll that empties/fills
 * the slot) so the host page shows its own static fallback only when it
 * actually knows there's nothing live — not before the request finishes,
 * which would flash static content then swap to the real banner — see
 * home.component.ts's usage.
 */
@Component({
  selector: 'app-responsive-banner',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './responsive-banner.component.html',
  styleUrl: './responsive-banner.component.scss',
})
export class ResponsiveBannerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) placementKey!: string;
  @Input() category?: string;
  @Output() readonly assetsLoaded = new EventEmitter<boolean>();

  private readonly assetService = inject(ApplicationAssetService);
  private autoAdvanceHandle: ReturnType<typeof setInterval> | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readonly onVisibilityChange = () => {
    if (!document.hidden && Date.now() - this.lastCheckedAt >= BANNER_POLL_MS) this.refresh();
  };

  /** Fingerprint of what's currently rendered — null until something (cache or network) has been applied. */
  private currentVersion: string | null = null;
  private lastCheckedAt = 0;
  private lastEmitted: boolean | null = null;
  private destroyed = false;

  readonly assets = signal<ApplicationAsset[]>([]);
  readonly activeIndex = signal(0);

  ngOnInit(): void {
    const cached = this.assetService.readCachedSet(this.placementKey, this.category);
    if (cached) this.apply(cached);

    this.refresh();
    this.pollHandle = setInterval(() => {
      if (!document.hidden) this.refresh();
    }, BANNER_POLL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopAutoAdvance();
    if (this.pollHandle !== null) clearInterval(this.pollHandle);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  selectIndex(i: number): void {
    this.activeIndex.set(i);
    this.restartAutoAdvance();
  }

  /** Raw stored URL for one breakpoint, falling back to the 'default'
   * image when that specific breakpoint wasn't uploaded — only 'default'
   * is ever guaranteed to exist (see applicationAssets.api.js's header
   * comment), everything else is an optional pixel-perfect override. */
  srcFor(asset: ApplicationAsset, breakpoint: AssetBreakpoint): string | null {
    const file = asset.files[breakpoint] ?? asset.files['default'];
    return file ? this.assetService.assetSrc(file.url) : null;
  }

  altFor(asset: ApplicationAsset): string {
    return asset.files['default']?.altText || asset.title;
  }

  /** One `/active` check — a no-op when the version hasn't changed. */
  private refresh(): void {
    this.lastCheckedAt = Date.now();
    this.assetService.getActive(this.placementKey, this.category).subscribe({
      next: (set) => {
        if (set.version === this.currentVersion) return;
        this.assetService.writeCachedSet(this.placementKey, this.category, set);

        // Nothing on screen yet → show it right away. Otherwise preload
        // first so the swap doesn't flash a half-loaded image.
        if (this.currentVersion === null || set.assets.length === 0) {
          this.apply(set);
          return;
        }
        this.assetService.preloadImages(this.visibleSrcs(set.assets)).then(() => {
          if (!this.destroyed) this.apply(set);
        });
      },
      error: () => {
        // Keep whatever is already showing (cached or from an earlier
        // poll). Only with nothing at all to show does a failure behave
        // like "nothing configured yet" — the host page's static fallback
        // covers both cases identically.
        if (this.currentVersion === null) this.emitHasAssets(false);
      },
    });
  }

  private apply(set: ActiveAssetSet): void {
    this.currentVersion = set.version;
    this.assets.set(set.assets);
    if (this.activeIndex() >= set.assets.length) this.activeIndex.set(0);
    if (set.assets.length > 1) this.startAutoAdvance();
    else this.stopAutoAdvance();
    this.emitHasAssets(set.assets.length > 0);
  }

  private emitHasAssets(hasAssets: boolean): void {
    if (hasAssets === this.lastEmitted) return;
    this.lastEmitted = hasAssets;
    this.assetsLoaded.emit(hasAssets);
  }

  /** The one image per asset the browser will actually pick at the current
   * viewport — same thresholds as the template's `<source media>` list. */
  private visibleSrcs(assets: ApplicationAsset[]): string[] {
    const bp: AssetBreakpoint = window.matchMedia('(max-width: 767px)').matches
      ? 'mobile'
      : window.matchMedia('(max-width: 1023px)').matches
        ? 'tablet'
        : window.matchMedia('(max-width: 1439px)').matches
          ? 'laptop'
          : 'monitor';
    return assets.map((a) => this.srcFor(a, bp)).filter((src): src is string => !!src);
  }

  private startAutoAdvance(): void {
    this.stopAutoAdvance();
    this.autoAdvanceHandle = setInterval(() => {
      const total = this.assets().length;
      if (total > 0) this.activeIndex.set((this.activeIndex() + 1) % total);
    }, AUTO_ADVANCE_MS);
  }

  private restartAutoAdvance(): void {
    if (this.assets().length > 1) this.startAutoAdvance();
  }

  private stopAutoAdvance(): void {
    if (this.autoAdvanceHandle !== null) {
      clearInterval(this.autoAdvanceHandle);
      this.autoAdvanceHandle = null;
    }
  }
}
