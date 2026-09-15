import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { OrderDetail, VerifyRazorpayPaymentRequest } from '../models/order.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `orders` module's razorpay-verify route
 * (`POST /customer/orders/:orderUuid/razorpay/verify`) — the
 * signature-verified confirmation step called right after Razorpay
 * Checkout's `handler` fires (see `RazorpayCheckoutService`). Everything
 * else about a razorpay payment (creating the gateway order at checkout,
 * reading its current status) rides on `OrderService`'s existing
 * `checkout()`/`getOrder()` responses (`OrderDetail.razorpayOrder`) — this
 * service exists only for the one write this app makes directly against
 * the payment/gateway boundary.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly base = `${environment.apiBaseUrl}/customer/orders`;
  private readonly http = inject(HttpClient);

  verifyRazorpayPayment(orderUuid: string, payload: VerifyRazorpayPaymentRequest): Observable<OrderDetail> {
    return this.http.post<ApiSuccess<OrderDetail>>(`${this.base}/${orderUuid}/razorpay/verify`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
