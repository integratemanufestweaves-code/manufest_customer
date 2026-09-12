import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { FaqCategory, FaqCategoryApiRow, FaqItem } from '../models/faq.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `faq` module public routes
 * (`src/modules/faq/faq.api.js`'s `publicRouter`, mounted `/api/v1/public/faq`).
 */
@Injectable({ providedIn: 'root' })
export class FaqService {
  private readonly base = `${environment.apiBaseUrl}/public/faq`;
  private readonly http = inject(HttpClient);

  listCategories(): Observable<FaqCategory[]> {
    return this.http.get<ApiSuccess<FaqCategoryApiRow[]>>(`${this.base}/categories`).pipe(
      map((res) => res.data.map((r) => ({ uuid: r.uuid, name: r.category_name, sortOrder: r.sort_order }))),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** `categoryUuid`/`q` both optional and combinable — `q` is a plain
   * `LIKE` against `question` server-side, no full-text search infra. */
  list(opts: { categoryUuid?: string | null; q?: string | null } = {}): Observable<FaqItem[]> {
    let params: Record<string, string> = {};
    if (opts.categoryUuid) params['categoryUuid'] = opts.categoryUuid;
    if (opts.q) params['q'] = opts.q;

    return this.http.get<ApiSuccess<FaqItem[]>>(`${this.base}/list`, { params }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
