import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiErrorBody, ApiSuccess, CursorMeta } from '../models/api.models';
import { ProductDetail, ProductSummary, RelatedProduct } from '../models/product.models';
import { ProductFilters } from '../models/product-filters.models';

export interface ProductPage {
  items: ProductSummary[];
  meta: CursorMeta;
}

export type ProductSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc';

export interface ListProductsOptions {
  cursor?: string | null;
  limit?: number;
  categoryUuid?: string | null;
  occasionUuid?: string | null;
  /** Multi-select filters (manufest_be 2026-10-01): OR within a group,
   * AND across groups. Sent comma-separated. */
  occasionUuids?: string[];
  fabricUuids?: string[];
  weaveUuids?: string[];
  /** Storefront search text (manufest_be matches every word against
   * name/SKU/category/colour/attributes/brand/district). */
  q?: string | null;
  /** Seller districts — `KeyedFilterOption.value` keys. */
  origins?: string[];
  /** Variant colour names — `ColorFilterOption.value` keys. */
  colors?: string[];
  /** Brand filter (one brand per seller). */
  sellerUuids?: string[];
  fabricPurityUuids?: string[];
  materialUuids?: string[];
  zariColorUuids?: string[];
  zariTypeUuids?: string[];
  borderTypeUuids?: string[];
  blouse?: 'with' | 'without' | null;
  /** Whole percent — at least one variant discounted by this much. */
  discountMin?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: ProductSort;
}

const MULTI_VALUE_PARAMS = [
  'occasionUuids',
  'fabricUuids',
  'weaveUuids',
  'origins',
  'colors',
  'sellerUuids',
  'fabricPurityUuids',
  'materialUuids',
  'zariColorUuids',
  'zariTypeUuids',
  'borderTypeUuids',
] as const;

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

  /**
   * `manufest_be` 2026-09-10: `GET /public/products/list` gained 5 optional,
   * AND-combinable query params (`applyPublicListFilters()` /
   * `publicListProducts` validation, see
   * manufest_be/.claude/knowledge/02-api-reference.md's "Filterable public
   * listing" entry) — `categoryUuid`, `occasionUuid`, `priceMin`/`priceMax`,
   * and `sort` ('newest' default | 'oldest'). `occasionUuid` is accepted
   * here for forward-compatibility even though nothing in this app can
   * populate an occasion picker yet — there is no public endpoint that
   * lists occasion values (`/seller/products/attributes-master` and
   * `/admin/products/attributes-master` are both auth-gated), so no UI
   * calls this with one today. `priceMin`/`priceMax` back the Home page's
   * "Shop by Price" tiles and the listing page's price filter;
   * `categoryUuid` backs "Shop by Category" and the listing page's
   * category filter; `sort` backs the listing page's Sort-by control —
   * `'newest'` is also literally what "New Arrivals" means server-side
   * (see that same doc entry: it's a sort order, not a separate filter).
   */
  listProducts(opts: ListProductsOptions = {}): Observable<ProductPage> {
    let params: Record<string, string> = {};
    if (opts.limit) params['limit'] = String(opts.limit);
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.categoryUuid) params['categoryUuid'] = opts.categoryUuid;
    if (opts.occasionUuid) params['occasionUuid'] = opts.occasionUuid;
    MULTI_VALUE_PARAMS.forEach((key) => {
      const values = opts[key];
      if (values?.length) params[key] = values.join(',');
    });
    if (opts.q?.trim()) params['q'] = opts.q.trim();
    if (opts.blouse) params['blouse'] = opts.blouse;
    if (opts.discountMin != null) params['discountMin'] = String(opts.discountMin);
    if (opts.priceMin != null) params['priceMin'] = String(opts.priceMin);
    if (opts.priceMax != null) params['priceMax'] = String(opts.priceMax);
    if (opts.sort) params['sort'] = opts.sort;

    return this.http.get<ApiSuccess<ProductSummary[]>>(`${this.base}/list`, { params }).pipe(
      map((res) => ({ items: res.data, meta: (res.meta as CursorMeta) ?? { limit: opts.limit ?? 20, nextCursor: null, hasMore: false } })),
      catchError((err) => this.rethrow(err)),
    );
  }

  /** `GET /public/products/filters` — browse taxonomy + live product
   * counts (see `ProductFilters`). `categoryUuid` scopes the counts to one
   * category, for the `/category/:uuid` listing's sidebar. */
  private allFilters$: Observable<ProductFilters> | null = null;

  /** Unscoped `getFilters()`, fetched once per page load and shared — the
   * header's filter menus and search suggestions read it. A
   * failed fetch isn't cached, so the next caller retries. */
  getAllFiltersCached(): Observable<ProductFilters> {
    if (!this.allFilters$) {
      this.allFilters$ = this.getFilters().pipe(
        catchError((err) => {
          this.allFilters$ = null;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.allFilters$;
  }

  getFilters(categoryUuid?: string | null): Observable<ProductFilters> {
    const params: Record<string, string> = categoryUuid ? { categoryUuid } : {};
    return this.http.get<ApiSuccess<ProductFilters>>(`${this.base}/filters`, { params }).pipe(
      map((res) => res.data),
      catchError((err) => this.rethrow(err)),
    );
  }

  getProductDetail(productUuid: string): Observable<ProductDetail> {
    return this.http.get<ApiSuccess<ProductDetail>>(`${this.base}/detail/${productUuid}`).pipe(
      map((res) => res.data),
      catchError((err) => this.rethrow(err)),
    );
  }

  /** `GET /public/products/detail/:productUuid/related` (added
   * 2026-09-24) — same category as `productUuid` is a hard boundary,
   * ranked within that by sub-category/name/price-proximity relevance.
   * `limit` capped at 20 server-side (defaults to 8). */
  getRelatedProducts(productUuid: string, limit = 8): Observable<RelatedProduct[]> {
    return this.http.get<ApiSuccess<RelatedProduct[]>>(`${this.base}/detail/${productUuid}/related`, { params: { limit: String(limit) } }).pipe(
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
