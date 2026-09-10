/**
 * manufest_be's shared response envelope — every route uses one of these
 * two shapes (see manufest_be/src/common/responseEnvelope.js). Mirrors
 * manufest_seller's `auth.models.ts` `ApiSuccess`/`ApiError` convention.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: CursorMeta | Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

/** Normalized shape `rethrow()` (in each service) throws on a failed call. */
export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

/**
 * `buildCursorMeta()` (manufest_be/src/common/pagination.js) — used by the
 * public product-listing routes, which are cursor-paginated (not
 * offset/page-numbered) since they're a high-traffic customer-facing feed.
 */
export interface CursorMeta {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}
