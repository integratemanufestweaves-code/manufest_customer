import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiErrorBody, ApiSuccess } from '../models/api.models';
import { Category, CategoryApiRow } from '../models/category.models';

/**
 * Client for manufest_be's `GET /public/categories/*` routes — see
 * manufest_be/.claude/knowledge/02-api-reference.md's `categories` section.
 */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly base = `${environment.apiBaseUrl}/public/categories`;

  constructor(private readonly http: HttpClient) {}

  listCategories(): Observable<Category[]> {
    return this.http.get<ApiSuccess<CategoryApiRow[]>>(`${this.base}/list`).pipe(
      map((res) => res.data.map(toCategory)),
      catchError((err) => this.rethrow(err)),
    );
  }

  /** `GET /public/categories/list_by_id/:categoryUuid` — used by the
   * product-listing page to resolve a category's display name for its
   * breadcrumb/heading when arriving via a `/category/:categoryUuid` link. */
  getCategory(categoryUuid: string): Observable<Category> {
    return this.http.get<ApiSuccess<CategoryApiRow>>(`${this.base}/list_by_id/${categoryUuid}`).pipe(
      map((res) => toCategory(res.data)),
      catchError((err) => this.rethrow(err)),
    );
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

function toCategory(row: CategoryApiRow): Category {
  return { uuid: row.uuid, name: row.name, slug: row.slug, imageUrl: row.image_url };
}
