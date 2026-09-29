import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiErrorBody, ApiSuccess } from '../models/api.models';
import { ActiveAssetSet, ApplicationAsset } from '../models/application-asset.models';

const CACHE_KEY_PREFIX = 'manufest.activeAssets.v1';

/**
 * Client for manufest_be's `GET /public/application-assets/*` routes —
 * powers ResponsiveBannerComponent (currently the homepage hero,
 * placementKey='home_hero_banner'; the same component works for any
 * future placement — header/footer logo, favicon, a second banner slot —
 * with no backend or service change, just a different placementKey).
 */
@Injectable({ providedIn: 'root' })
export class ApplicationAssetService {
  private readonly base = `${environment.apiBaseUrl}/public/application-assets`;

  constructor(private readonly http: HttpClient) {}

  /** Currently-live assets for one slot, already ordered by sort_order —
   * zero, one, or several (several means the caller should render a
   * carousel; see applicationAssets.api.js's header comment on why
   * `is_active` isn't single-choice-per-placement) — plus the backend's
   * `meta.version` fingerprint of that set, for cheap change detection
   * when polling. */
  getActive(placementKey: string, category?: string): Observable<ActiveAssetSet> {
    const params: Record<string, string> = { placementKey };
    if (category) params['category'] = category;
    return this.http.get<ApiSuccess<ApplicationAsset[]>>(`${this.base}/active`, { params }).pipe(
      map((res) => {
        const version = (res.meta as Record<string, unknown> | undefined)?.['version'];
        // An older backend without meta.version still works — the payload
        // itself is the fingerprint then.
        return { assets: res.data, version: typeof version === 'string' ? version : JSON.stringify(res.data) };
      }),
      catchError((err) => this.rethrow(err)),
    );
  }

  /** Last live set seen for this slot on this device (localStorage), so a
   * repeat visit renders the banner instantly instead of waiting on
   * `/active`. The images themselves come from the browser's HTTP cache —
   * `/media` responses are `immutable`, so each is downloaded once. */
  readCachedSet(placementKey: string, category?: string): ActiveAssetSet | null {
    try {
      const raw = localStorage.getItem(this.cacheKey(placementKey, category));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ActiveAssetSet;
      return Array.isArray(parsed?.assets) && typeof parsed.version === 'string' ? parsed : null;
    } catch {
      return null; // storage blocked (private mode) or corrupt — just fetch
    }
  }

  writeCachedSet(placementKey: string, category: string | undefined, set: ActiveAssetSet): void {
    try {
      localStorage.setItem(this.cacheKey(placementKey, category), JSON.stringify(set));
    } catch {
      /* storage full/blocked — the banner still works, just without the instant repeat-visit render */
    }
  }

  /** Resolves once every url has loaded (or failed — a broken image
   * shouldn't block a banner swap forever), so a new banner can be swapped
   * in already-decoded instead of flashing in half-loaded. */
  preloadImages(urls: string[]): Promise<void> {
    return Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => resolve();
            img.src = url;
          }),
      ),
    ).then(() => undefined);
  }

  /**
   * Rewrites a raw (private, unsigned) applicationAssetStorage URL — as
   * found in an `ApplicationAsset.files[<breakpoint>].url` — into a URL the
   * browser can actually load: manufest_be's
   * `GET /public/application-assets/media?url=` proxy, backed by the same
   * read-only `media_ready_only_user` IAM credentials `ProductService`'s
   * own `mediaSrc()` uses (that IAM user already has GetObject on the
   * whole bucket, not just `product-media/*`, so it covers
   * `application_asset/*` too — see applicationAssets.api.js's header
   * comment). Fully public/unauthenticated, so this can be used directly
   * as an `<img>`/`<source>` `src`/`srcset`.
   */
  assetSrc(rawUrl: string | null | undefined): string | null {
    if (!rawUrl) return null;
    return `${this.base}/media?url=${encodeURIComponent(rawUrl)}`;
  }

  private cacheKey(placementKey: string, category?: string): string {
    return `${CACHE_KEY_PREFIX}:${placementKey}:${category ?? ''}`;
  }

  private rethrow(err: unknown): Observable<never> {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiErrorBody | undefined;
      if (body && body.success === false && body.error) {
        const apiError: ApiError = { code: body.error.code, message: body.error.message, requestId: body.error.requestId, details: body.error.details };
        return throwError(() => apiError);
      }
      return throwError(() => ({ code: 'NETWORK_ERROR', message: err.message || 'Could not reach the server.' } as ApiError));
    }
    return throwError(() => ({ code: 'UNKNOWN_ERROR', message: 'Something went wrong.' } as ApiError));
  }
}
