import { Injectable } from '@angular/core';
import { RazorpayOrderInfo, VerifyRazorpayPaymentRequest } from '../models/order.models';

export type RazorpayCheckoutOutcome =
  | { outcome: 'success'; payload: VerifyRazorpayPaymentRequest }
  | { outcome: 'dismissed' };

/**
 * Thin promise wrapper around the global `Razorpay` constructor
 * (`https://checkout.razorpay.com/v1/checkout.js`, loaded in `index.html`
 * — see `src/types/razorpay.d.ts` for the ambient type, there's no
 * official `@types` package for the client-side widget). Two outcomes,
 * both resolved (never rejected) since neither is an error the caller
 * should treat as one: `'success'` when the widget's own `handler`
 * fires (still needs server-side verification — see
 * `PaymentService.verifyRazorpayPayment`), or `'dismissed'` when the
 * customer closes the popup without completing payment (`modal.ondismiss`)
 * — the order already exists server-side either way, so this is never a
 * failure state on its own.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  open(order: RazorpayOrderInfo, prefill?: { name?: string; email?: string; contact?: string }): Promise<RazorpayCheckoutOutcome> {
    return new Promise((resolve) => {
      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Manufest Weaves',
        prefill,
        // Matches --color-primary in styles.scss — Checkout.js can't read
        // a CSS custom property (it's a separately-hosted iframe), so the
        // value is duplicated here by hand.
        theme: { color: '#5a1d40' },
        handler: (response) => {
          resolve({
            outcome: 'success',
            payload: {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            },
          });
        },
        modal: {
          ondismiss: () => resolve({ outcome: 'dismissed' }),
        },
      });
      checkout.open();
    });
  }
}
