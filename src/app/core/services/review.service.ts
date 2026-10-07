import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess, OffsetMeta } from '../models/api.models';
import { CreateReviewRequest, ProductReview } from '../models/review.models';
import { rethrowApiError } from './http-error.util';

export interface ReviewPage {
  items: ProductReview[];
  meta: OffsetMeta;
}

/**
 * Client for manufest_be's `product-reviews` module
 * (`src/modules/product-reviews/productReviews.api.js`): the public router
 * (mounted `/api/v1/public/product-reviews`, active reviews only) and the
 * customer router (mounted `/api/v1/customer/product-reviews`). See
 * `review.models.ts` for the verified-purchase and moderation rules.
 */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly publicBase = `${environment.apiBaseUrl}/public/product-reviews`;
  private readonly customerBase = `${environment.apiBaseUrl}/customer/product-reviews`;
  private readonly http = inject(HttpClient);

  listForProduct(productUuid: string, page = 1, limit = 10): Observable<ReviewPage> {
    const params = { page: String(page), limit: String(limit) };
    return this.http.get<ApiSuccess<ProductReview[]>>(`${this.publicBase}/products/${productUuid}/reviews`, { params }).pipe(
      map((res) => ({ items: res.data, meta: res.meta as unknown as OffsetMeta })),
      catchError((err) => rethrowApiError(err)),
    );
  }

  create(payload: CreateReviewRequest): Observable<ProductReview> {
    return this.http.post<ApiSuccess<ProductReview>>(this.customerBase, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
