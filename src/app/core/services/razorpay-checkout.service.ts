import { Injectable } from '@angular/core';
import { RazorpayOrderInfo, VerifyRazorpayPaymentRequest } from '../models/order.models';

export type RazorpayCheckoutOutcome =
  | { outcome: 'success'; payload: VerifyRazorpayPaymentRequest }
  | { outcome: 'dismissed' };

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Thin promise wrapper around the global `Razorpay` constructor
 * (`https://checkout.razorpay.com/v1/checkout.js` — see
 * `src/types/razorpay.d.ts` for the ambient type, there's no official
 * `@types` package for the client-side widget). The script is injected
 * lazily by `loadScript()` below the first time `open()` is called, not
 * eagerly in index.html (that used to be the case, but Checkout.js pulls in
 * its own large graph of per-payment-method chunks the instant it
 * initializes — that was firing on every page, not just checkout). Two
 * outcomes, both resolved (never rejected) since neither is an error the
 * caller should treat as one: `'success'` when the widget's own `handler`
 * fires (still needs server-side verification — see
 * `PaymentService.verifyRazorpayPayment`), or `'dismissed'` when the
 * customer closes the popup without completing payment (`modal.ondismiss`),
 * or the script itself fails to load (e.g. an ad-blocker on
 * checkout.razorpay.com) — the order already exists server-side either way,
 * so this is never a failure state on its own, and stays retryable from
 * order-detail's "Complete payment".
 */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private scriptLoad: Promise<boolean> | null = null;

  open(order: RazorpayOrderInfo, prefill?: { name?: string; email?: string; contact?: string }): Promise<RazorpayCheckoutOutcome> {
    return this.loadScript().then((loaded) => {
      if (!loaded || !window.Razorpay) {
        return { outcome: 'dismissed' };
      }

      return new Promise<RazorpayCheckoutOutcome>((resolve) => {
        const checkout = new window.Razorpay!({
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
    });
  }

  /** Cached so a second `open()` call (e.g. dismiss-then-retry) reuses the
   * already-loaded script instead of injecting a duplicate `<script>` tag. */
  private loadScript(): Promise<boolean> {
    if (window.Razorpay) {
      return Promise.resolve(true);
    }
    if (!this.scriptLoad) {
      this.scriptLoad = new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = CHECKOUT_SCRIPT_SRC;
        script.onload = () => resolve(true);
        script.onerror = () => {
          this.scriptLoad = null;
          resolve(false);
        };
        document.head.appendChild(script);
      });
    }
    return this.scriptLoad;
  }
}
