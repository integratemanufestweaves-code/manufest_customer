import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiErrorBody, ApiSuccess } from '../models/api.models';
import { ApplicationAsset } from '../models/application-asset.models';

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
   * `is_active` isn't single-choice-per-placement). */
  getActive(placementKey: string, category?: string): Observable<ApplicationAsset[]> {
    const params: Record<string, string> = { placementKey };
    if (category) params['category'] = category;
    return this.http.get<ApiSuccess<ApplicationAsset[]>>(`${this.base}/active`, { params }).pipe(
      map((res) => res.data),
      catchError((err) => this.rethrow(err)),
    );
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
