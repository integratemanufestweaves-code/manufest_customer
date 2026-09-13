import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess, OffsetMeta } from '../models/api.models';
import { CheckoutRequest, OrderDetail, OrderSummary } from '../models/order.models';
import { rethrowApiError } from './http-error.util';

export interface OrderPage {
  items: OrderSummary[];
  meta: OffsetMeta;
}

export interface ListOrdersOptions {
  page?: number;
  limit?: number;
  orderStatus?: string | null;
}

/**
 * Client for manufest_be's `orders` module (`src/modules/orders/orders.api.js`,
 * `customerRouter` mounted `/api/v1/customer/orders`) — every route
 * requires an authenticated customer. Checkout consumes whatever's
 * currently in the server-side cart (`cart_items`) — there is no
 * client-supplied line-item list, so a successful `checkout()` call also
 * implicitly empties the cart server-side; callers should refresh
 * `CartService` afterward (see `CheckoutComponent`).
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly base = `${environment.apiBaseUrl}/customer/orders`;
  private readonly http = inject(HttpClient);

  checkout(payload: CheckoutRequest): Observable<OrderDetail> {
    return this.http.post<ApiSuccess<OrderDetail>>(`${this.base}/checkout`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  listOrders(opts: ListOrdersOptions = {}): Observable<OrderPage> {
    let params: Record<string, string> = {};
    if (opts.page) params['page'] = String(opts.page);
    if (opts.limit) params['limit'] = String(opts.limit);
    if (opts.orderStatus) params['orderStatus'] = opts.orderStatus;

    return this.http.get<ApiSuccess<OrderSummary[]>>(`${this.base}/list`, { params }).pipe(
      map((res) => ({ items: res.data, meta: res.meta as unknown as OffsetMeta })),
      catchError((err) => rethrowApiError(err)),
    );
  }

  getOrder(orderUuid: string): Observable<OrderDetail> {
    return this.http.get<ApiSuccess<OrderDetail>>(`${this.base}/list_by_id/${orderUuid}`).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** `reason` is required server-side (`ordersValidation.cancelOrder`,
   * added 2026-09-13 alongside `orders.cancel_reason`) — cancelling used to
   * be a single frictionless click with nothing recorded about why. */
  cancelOrder(orderUuid: string, reason: string): Observable<OrderDetail> {
    return this.http.post<ApiSuccess<OrderDetail>>(`${this.base}/${orderUuid}/cancel`, { reason }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  requestReturn(orderItemUuid: string, reason: string): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/order-items/${orderItemUuid}/return-request`, { reason }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  requestReplacement(orderItemUuid: string, reason: string): Observable<{ status: string }> {
    return this.http
      .post<ApiSuccess<{ status: string }>>(`${this.base}/order-items/${orderItemUuid}/replacement-request`, { reason })
      .pipe(
        map((res) => res.data),
        catchError((err) => rethrowApiError(err)),
      );
  }
}
