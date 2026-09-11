import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';

import { ApplicationAssetService } from '../../core/services/application-asset.service';
import { ApplicationAsset, AssetBreakpoint } from '../../core/models/application-asset.models';

const AUTO_ADVANCE_MS = 6000;

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
 * Deliberately generic on `placementKey` (and optional `category`) rather
 * than hardcoded to the homepage hero — a future logo/favicon/secondary-
 * banner placement reuses this exact component with a different input,
 * no new component needed (see manufest_be's applicationAssets.api.js
 * header comment for the matching backend-side generality).
 *
 * Emits `assetsLoaded` once the initial request resolves so the host page
 * can show its own static fallback content only once it actually knows
 * there's nothing live to display (not before the request finishes, which
 * would flash static content then swap to the real banner) — see
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

  readonly assets = signal<ApplicationAsset[]>([]);
  readonly activeIndex = signal(0);

  ngOnInit(): void {
    this.assetService.getActive(this.placementKey, this.category).subscribe({
      next: (assets) => {
        this.assets.set(assets);
        this.assetsLoaded.emit(assets.length > 0);
        if (assets.length > 1) this.startAutoAdvance();
      },
      error: () => {
        // A failed request behaves exactly like "nothing configured yet" —
        // the host page's static fallback covers both cases identically.
        this.assets.set([]);
        this.assetsLoaded.emit(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoAdvance();
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
