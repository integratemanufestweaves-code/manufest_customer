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

  /** The Razorpay popup closed without a verified success. The backend asks
   * Razorpay what actually happened and returns the settled checkout:
   * `orderStatus` 'payment_failed' (not placed, stock released, cart kept),
   * 'payment_processing' (paid, awaiting Razorpay's confirmation), a placed
   * status (the capture had already landed), or still 'awaiting_payment' if
   * Razorpay couldn't be reached (the backend settles it within 15 minutes). */
  dismissRazorpayPayment(orderUuid: string): Observable<OrderDetail> {
    return this.http.post<ApiSuccess<OrderDetail>>(`${this.base}/${orderUuid}/razorpay/dismiss`, {}).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
