import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiErrorBody, ApiSuccess, CursorMeta } from '../models/api.models';
import { ProductDetail, ProductSummary } from '../models/product.models';

export interface ProductPage {
  items: ProductSummary[];
  meta: CursorMeta;
}

/**
 * Client for manufest_be's `GET /public/products/*` routes — see
 * manufest_be/.claude/knowledge/02-api-reference.md's `products` section.
 * Every call here is an unauthenticated public GET; there is no seller/
 * admin surface in this app.
 *
 * Same `rethrow()` normalization pattern every `*.service.ts` in
 * manufest_seller uses, so a component can `catchError`/display
 * `err.message` without caring whether the failure was a network error or
 * a structured `ApiErrorBody` from the backend.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly base = `${environment.apiBaseUrl}/public/products`;

  constructor(private readonly http: HttpClient) {}

  listProducts(opts: { cursor?: string | null; limit?: number } = {}): Observable<ProductPage> {
    let params: Record<string, string> = {};
    if (opts.limit) params['limit'] = String(opts.limit);
    if (opts.cursor) params['cursor'] = opts.cursor;

    return this.http.get<ApiSuccess<ProductSummary[]>>(`${this.base}/list`, { params }).pipe(
      map((res) => ({ items: res.data, meta: (res.meta as CursorMeta) ?? { limit: opts.limit ?? 20, nextCursor: null, hasMore: false } })),
      catchError((err) => this.rethrow(err)),
    );
  }

  getProductDetail(productUuid: string): Observable<ProductDetail> {
    return this.http.get<ApiSuccess<ProductDetail>>(`${this.base}/detail/${productUuid}`).pipe(
      map((res) => res.data),
      catchError((err) => this.rethrow(err)),
    );
  }

  /**
   * Rewrites a raw (private, unsigned) productMediaStorage URL — as found
   * in `ProductSummary.thumbnail.url` / `ProductDetail.media[].url` /
   * `ProductVariant.media[].url` — into a URL the browser can actually
   * load: manufest_be's `GET /public/products/media?url=` proxy, backed by
   * the read-only `media_ready_only_user` IAM credentials added
   * server-side alongside this app (see manufest_be's
   * `.claude/knowledge/05-config-env.md`, 2026-09-08 entry).
   *
   * Unlike manufest_seller's equivalent (`getMediaBlob()`, which fetches a
   * `Blob` and wraps it in an object URL because that route needs the
   * seller's session cookie and per-caller ownership check), this proxy is
   * fully public and unauthenticated — so the proxied URL can be used
   * directly as an `<img>`/`<video>` `src`, no fetch-and-revoke dance
   * needed, and the browser's normal HTTP cache applies.
   */
  mediaSrc(rawUrl: string | null | undefined): string | null {
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
