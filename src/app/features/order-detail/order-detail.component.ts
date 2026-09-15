import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { ProductService } from '../../core/services/product.service';
import { OrderDetail, OrderItem } from '../../core/models/order.models';

/**
 * `GET /customer/orders/list_by_id/:orderUuid` (`orders.api.js`) — full
 * order detail: shipping address snapshot, payment, and every seller
 * group's items. Cancel/return/replacement actions call back into the same
 * module's `POST /:orderUuid/cancel`, `POST
 * /order-items/:orderItemUuid/return-request`, and `.../replacement-request`
 * — see that module's header comment for the eligibility rules each one
 * enforces server-side (cancel needs a 'pending'/'confirmed' item;
 * return/replacement need 'delivered'). Rather than duplicate that
 * eligibility logic client-side, buttons are shown a little more broadly
 * and a rejected action just surfaces the backend's own message (e.g.
 * "Nothing in this order can be cancelled").
 *
 * Cancel used to fire instantly on one click — no confirmation, no reason,
 * nothing recorded. That made it free to place-and-cancel repeatedly (each
 * cancel releases real reserved/sold inventory back to a seller). Now it's
 * a two-step flow, same shape as the existing return/replacement inline
 * form: clicking "Cancel order" opens a confirmation panel requiring a
 * reason (mirrors `orders.validation.js`'s now-required `reason` on
 * `POST /:orderUuid/cancel`) before the request actually fires.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);
  private readonly razorpayCheckout = inject(RazorpayCheckoutService);
  private readonly productService = inject(ProductService);

  readonly order = signal<OrderDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** `true` once "Cancel order" has been clicked and the confirmation +
   * reason panel is showing — separate from `cancelling` (the in-flight
   * request state) so the panel can be dismissed without ever calling the
   * API ("Never mind"). */
  readonly showCancelForm = signal(false);
  cancelReason = '';
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);

  /** `orderItemUuid` currently showing its inline return/replacement reason
   * form, and which kind — `null` when none is open. */
  readonly actionForm = signal<{ orderItemUuid: string; kind: 'return' | 'replacement' } | null>(null);
  actionReason = '';
  readonly actionSubmitting = signal(false);
  readonly actionError = signal<string | null>(null);

  private readonly brokenThumbnails = signal<ReadonlySet<string>>(new Set());

  /** In-flight state for "Complete payment" (see `order.razorpayOrder`'s
   * own doc comment) — re-opens Checkout.js against the SAME gateway order
   * created at checkout time, for a customer who closed the popup earlier
   * without paying. */
  readonly completingPayment = signal(false);
  readonly completePaymentError = signal<string | null>(null);

  ngOnInit(): void {
    const orderUuid = this.route.snapshot.paramMap.get('orderUuid');
    if (!orderUuid) {
      this.error.set('Order not found.');
      this.loading.set(false);
      return;
    }
    this.load(orderUuid);
  }

  private load(orderUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.orderService.getOrder(orderUuid).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load this order.');
        this.loading.set(false);
      },
    });
  }

  formatPrice(n: number): string {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  thumbnailSrc(item: OrderItem): string | null {
    if (this.brokenThumbnails().has(item.uuid)) return null;
    return this.productService.mediaSrc(item.product.primaryImage);
  }

  onThumbnailError(item: OrderItem): void {
    this.brokenThumbnails.update((set) => new Set(set).add(item.uuid));
  }

  get isCancellable(): boolean {
    const status = this.order()?.orderStatus;
    return !!status && !['cancelled', 'delivered', 'returned'].includes(status);
  }

  startCancelOrder(): void {
    this.cancelReason = '';
    this.cancelError.set(null);
    this.showCancelForm.set(true);
  }

  closeCancelForm(): void {
    this.showCancelForm.set(false);
  }

  confirmCancelOrder(): void {
    const order = this.order();
    if (!order) return;
    if (!this.cancelReason.trim()) {
      this.cancelError.set('Tell us why you\'re cancelling.');
      return;
    }
    this.cancelError.set(null);
    this.cancelling.set(true);
    this.orderService.cancelOrder(order.uuid, this.cancelReason.trim()).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancelling.set(false);
        this.showCancelForm.set(false);
      },
      error: (err) => {
        this.cancelError.set(err?.message || 'Could not cancel this order.');
        this.cancelling.set(false);
      },
    });
  }

  completePayment(): void {
    const order = this.order();
    if (!order?.razorpayOrder) return;

    this.completePaymentError.set(null);
    this.completingPayment.set(true);

    this.razorpayCheckout
      .open(order.razorpayOrder, { name: order.shippingAddress.recipientName, contact: order.shippingAddress.phone })
      .then((result) => {
        if (result.outcome === 'dismissed') {
          this.completingPayment.set(false);
          return;
        }
        this.paymentService.verifyRazorpayPayment(order.uuid, result.payload).subscribe({
          next: (updated) => {
            this.order.set(updated);
            this.completingPayment.set(false);
          },
          error: (err) => {
            this.completePaymentError.set(err?.message || 'Could not confirm this payment. Please try again.');
            this.completingPayment.set(false);
            // The verify call may have already marked the attempt failed
            // server-side (e.g. bad signature) — reload so the payment
            // status shown here reflects that instead of going stale.
            this.load(order.uuid);
          },
        });
      });
  }

  openActionForm(item: OrderItem, kind: 'return' | 'replacement'): void {
    this.actionForm.set({ orderItemUuid: item.uuid, kind });
    this.actionReason = '';
    this.actionError.set(null);
  }

  closeActionForm(): void {
    this.actionForm.set(null);
  }

  submitActionForm(): void {
    const form = this.actionForm();
    const order = this.order();
    if (!form || !order) return;
    if (!this.actionReason.trim()) {
      this.actionError.set('Tell us why so we can process this faster.');
      return;
    }
    this.actionError.set(null);
    this.actionSubmitting.set(true);

    const request$ =
      form.kind === 'return'
        ? this.orderService.requestReturn(form.orderItemUuid, this.actionReason.trim())
        : this.orderService.requestReplacement(form.orderItemUuid, this.actionReason.trim());

    request$.subscribe({
      next: () => {
        this.actionSubmitting.set(false);
        this.actionForm.set(null);
        this.load(order.uuid);
      },
      error: (err) => {
        this.actionError.set(err?.message || 'Could not submit this request.');
        this.actionSubmitting.set(false);
      },
    });
  }
}
