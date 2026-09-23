import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { RecentlyViewedItem } from '../models/recently-viewed.models';
import { rethrowApiError } from './http-error.util';

/**
 * `manufest_be`'s `recently-viewed` module, mounted
 * `/api/v1/customer/recently-viewed` — every route requires an
 * authenticated customer (see that module's own header comment for why
 * this is deliberately separate from the public product-detail view-count
 * increment). Callers must check `AuthService.isAuthenticated()` first;
 * nothing here does it internally.
 */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly base = `${environment.apiBaseUrl}/customer/recently-viewed`;
  private readonly http = inject(HttpClient);

  /** Home-page ribbon data — most-recently-viewed first, `limit` capped at
   * 50 server-side (defaults to 10). */
  list(limit = 10): Observable<RecentlyViewedItem[]> {
    return this.http.get<ApiSuccess<RecentlyViewedItem[]>>(this.base, { params: { limit: String(limit) } }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Fire-and-forget from the product-detail page — upserts the view,
   * touching `viewedAt` on a re-view instead of duplicating. */
  recordView(productUuid: string): Observable<void> {
    return this.http.post<ApiSuccess<{ productUuid: string; recorded: boolean }>>(this.base, { productUuid }).pipe(
      map(() => undefined),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
