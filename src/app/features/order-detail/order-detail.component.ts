import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { ProductService } from '../../core/services/product.service';
import { ShipmentService } from '../../core/services/shipment.service';
import { OrderDetail, OrderItem, Shipment } from '../../core/models/order.models';
import { formatPrice } from '../../core/utils/format-price';

/** Mirrors `RETURN_WINDOW_DAYS` (backend, `manufest_be/src/config/env.schema.js`,
 * default 7) — added 2026-09-22 alongside `RETURN_WINDOW_EXPIRED`. There's
 * no API to read the configured value, so this is the same default,
 * hardcoded; it only gates which buttons this page shows; the backend's
 * own check is what's actually authoritative on every return-request call
 * regardless of what this constant says. */
const RETURN_WINDOW_DAYS = 7;

/**
 * `GET /customer/orders/list_by_id/:orderUuid` (`orders.api.js`) — full
 * order detail: shipping address snapshot, payment, and every seller
 * group's items. Cancel/return/replacement actions call back into the same
 * module's `POST /:orderUuid/cancel`, `POST /:orderUuid/return-request`
 * (bulk-capable, added 2026-09-22 — omit item uuids for the whole order),
 * and `.../order-items/:orderItemUuid/replacement-request` — see that
 * module's header comment for the eligibility rules each one enforces
 * server-side (cancel needs a 'pending'/'confirmed' item; return/replacement
 * need 'delivered'). Rather than duplicate that eligibility logic
 * client-side, buttons are shown a little more broadly and a rejected
 * action just surfaces the backend's own message (e.g. "Nothing in this
 * order can be cancelled").
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
  private readonly shipmentService = inject(ShipmentService);

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

  /** Which return reason panel is open, if any — `mode: 'item'` is the
   * inline per-item panel (mirrors the item's own row, same as
   * replacement); `mode: 'all'` is the header-level "Return order" panel
   * that requests every currently-`delivered` item in one bulk call. */
  readonly returnPanel = signal<{ mode: 'item'; orderItemUuid: string } | { mode: 'all' } | null>(null);
  returnReason = '';
  readonly returnSubmitting = signal(false);
  readonly returnError = signal<string | null>(null);

  /** `orderItemUuid` currently showing its inline replacement reason form —
   * `null` when none is open. Replacement is unrelated to the refund flow
   * (untouched backend route), kept separate from `returnPanel`. */
  readonly replacementItemUuid = signal<string | null>(null);
  replacementReason = '';
  readonly replacementSubmitting = signal(false);
  readonly replacementError = signal<string | null>(null);

  private readonly brokenThumbnails = signal<ReadonlySet<string>>(new Set());

  /** In-flight state for "Complete payment" (see `order.razorpayOrder`'s
   * own doc comment) — re-opens Checkout.js against the SAME gateway order
   * created at checkout time, for a customer who closed the popup earlier
   * without paying. */
  readonly completingPayment = signal(false);
  readonly completePaymentError = signal<string | null>(null);

  /** `orderItemUuid` whose "Track package" panel is currently open —
   * shipment info is fetched lazily on demand (one extra call per item
   * expanded), not eagerly for the whole order, since most items will
   * never be expanded in a given visit. */
  readonly trackingOpenItemUuid = signal<string | null>(null);
  readonly trackingLoading = signal(false);
  readonly trackingError = signal<string | null>(null);
  readonly trackingData = signal<Shipment | null>(null);

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
    return formatPrice(n);
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  /** Customer-facing wording for a parcel's courier status. */
  dispatchLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Preparing your parcel',
      ready_to_ship: 'Packed, waiting for courier pickup',
      pickup_scheduled: 'Courier pickup scheduled',
      picked_up: 'Picked up by courier',
      in_transit: 'In transit',
      out_for_delivery: 'Out for delivery',
      undelivered: 'Delivery attempt failed. The courier will try again',
      delivered: 'Delivered',
      failed: 'There is a problem with this delivery. Please contact support',
      rto: 'Returning to seller',
    };
    return labels[status] ?? this.statusLabel(status);
  }

  /** A cancelled courier booking isn't a parcel on its way — show it as
   * "no tracking yet" rather than a dead AWB. */
  visibleShipment(shipment: Shipment | null): Shipment | null {
    if (!shipment || shipment.dispatchStatus === 'cancelled' || !shipment.trackingNumber) return null;
    return shipment;
  }

  /** Short explainer shown under a return-related item status so "Return
   * approved" doesn't read as a dead end while the refund is still moving. */
  returnStatusNote(status: OrderItem['itemStatus']): string | null {
    switch (status) {
      case 'return_requested':
        return 'Awaiting approval';
      case 'return_approved':
        return 'Approved — refund is being processed';
      case 'returned':
        return 'Return complete';
      default:
        return null;
    }
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

  /** Whether at least one item is still eligible for a return request —
   * gates the header-level "Return order" button. Requires both
   * `delivered` and still within `RETURN_WINDOW_DAYS` — the backend
   * silently excludes an expired item from an implicit "return everything"
   * call rather than erroring, so this stays consistent with that. */
  get hasReturnableItems(): boolean {
    const order = this.order();
    if (!order) return false;
    return order.sellerGroups.some((group) =>
      group.items.some((item) => item.itemStatus === 'delivered' && this.isWithinReturnWindow(item.deliveredAt)),
    );
  }

  isWithinReturnWindow(deliveredAt: string | null): boolean {
    if (!deliveredAt) return false;
    const deadline = new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() <= deadline;
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

  openItemReturnForm(item: OrderItem): void {
    this.returnPanel.set({ mode: 'item', orderItemUuid: item.uuid });
    this.returnReason = '';
    this.returnError.set(null);
  }

  openOrderReturnForm(): void {
    this.returnPanel.set({ mode: 'all' });
    this.returnReason = '';
    this.returnError.set(null);
  }

  closeReturnForm(): void {
    this.returnPanel.set(null);
  }

  confirmReturn(): void {
    const order = this.order();
    const panel = this.returnPanel();
    if (!order || !panel) return;
    if (!this.returnReason.trim()) {
      this.returnError.set('Tell us why you\'re returning this.');
      return;
    }
    this.returnError.set(null);
    this.returnSubmitting.set(true);

    const orderItemUuids = panel.mode === 'item' ? [panel.orderItemUuid] : undefined;

    this.orderService.requestReturn(order.uuid, { orderItemUuids, reason: this.returnReason.trim() }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.returnSubmitting.set(false);
        this.returnPanel.set(null);
      },
      error: (err) => {
        this.returnError.set(err?.message || 'Could not submit this return request.');
        this.returnSubmitting.set(false);
      },
    });
  }

  openReplacementForm(item: OrderItem): void {
    this.replacementItemUuid.set(item.uuid);
    this.replacementReason = '';
    this.replacementError.set(null);
  }

  closeReplacementForm(): void {
    this.replacementItemUuid.set(null);
  }

  submitReplacementForm(): void {
    const orderItemUuid = this.replacementItemUuid();
    const order = this.order();
    if (!orderItemUuid || !order) return;
    if (!this.replacementReason.trim()) {
      this.replacementError.set('Tell us why so we can process this faster.');
      return;
    }
    this.replacementError.set(null);
    this.replacementSubmitting.set(true);

    this.orderService.requestReplacement(orderItemUuid, this.replacementReason.trim()).subscribe({
      next: () => {
        this.replacementSubmitting.set(false);
        this.replacementItemUuid.set(null);
        this.load(order.uuid);
      },
      error: (err) => {
        this.replacementError.set(err?.message || 'Could not submit this request.');
        this.replacementSubmitting.set(false);
      },
    });
  }

  /** A shipment only ever exists for an item a seller has actually
   * dispatched — no point offering "Track package" any earlier. */
  canTrackPackage(item: OrderItem): boolean {
    return item.itemStatus === 'shipped' || item.itemStatus === 'delivered';
  }

  toggleTracking(item: OrderItem): void {
    if (this.trackingOpenItemUuid() === item.uuid) {
      this.trackingOpenItemUuid.set(null);
      return;
    }

    this.trackingOpenItemUuid.set(item.uuid);
    this.trackingData.set(null);
    this.trackingError.set(null);
    this.trackingLoading.set(true);

    this.shipmentService.getForItem(item.uuid).subscribe({
      next: (shipment) => {
        this.trackingLoading.set(false);
        this.trackingData.set(shipment);
      },
      error: (err) => {
        this.trackingLoading.set(false);
        this.trackingError.set(err?.message || 'Could not load tracking info.');
      },
    });
  }
}
