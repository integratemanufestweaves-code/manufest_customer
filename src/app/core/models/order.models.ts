/**
 * Shapes for manufest_be's `orders` module (`src/modules/orders/orders.api.js`,
 * `customerRouter` mounted `/api/v1/customer/orders`) — read directly from
 * that file's `toPublicOrderSummary`/`toPublicOrderSellerGroup`/
 * `toPublicOrderItem`/`loadOrderDetail`, not just the knowledge-base
 * summary (this module post-dates `CUSTOMER_APP_TODO.md`'s "checkout is
 * entirely blocked" §7 audit).
 *
 * `cod`/`manual` are unchanged; `razorpay` (added 2026-09-14) is the online
 * gateway path — courier/shipping is still manual tracking entry.
 * `orders.validation.js`'s `checkout` schema is the source of truth for
 * `CheckoutRequest`.
 */

export type PaymentMethod = 'cod' | 'manual' | 'razorpay';

export interface CheckoutRequest {
  addressUuid: string;
  paymentMethod: PaymentMethod;
  markOrderAsGift?: boolean;
  /** Optional subset of `cart_items.uuid` to convert into this order — lets
   * the customer check out selected items instead of the whole cart.
   * Omit entirely to check out everything currently in the cart. */
  cartItemUuids?: string[];
}

/**
 * `POST /customer/orders/delivery-check` — whether a courier can bring each
 * checkout line from its seller's pickup address to the chosen address.
 * `not_deliverable`/`seller_unavailable` block the order (the backend refuses
 * checkout with `NOT_DELIVERABLE` too); `unknown` = couldn't be checked right
 * now and doesn't block; `unchecked` = the check is switched off.
 */
export type DeliveryStatus = 'deliverable' | 'not_deliverable' | 'seller_unavailable' | 'unknown' | 'unchecked';

export interface DeliveryCheckItem {
  cartItemUuid: string;
  status: DeliveryStatus;
  estimatedDeliveryDays: number | null;
  /** Courier's estimate as Shiprocket words it, e.g. "Nov 19, 2026". */
  etd: string | null;
}

export interface DeliveryCheckResult {
  postalCode: string;
  checked: boolean;
  deliverable: boolean;
  /** The slowest line's estimate — when the whole order should have arrived. */
  estimatedDeliveryDays: number | null;
  message: string | null;
  items: DeliveryCheckItem[];
}

export interface DeliveryCheckRequest {
  addressUuid: string;
  paymentMethod?: PaymentMethod;
  cartItemUuids?: string[];
}

/** Present on `OrderDetail` only while there's actually something to pay
 * for a `razorpay`-method order (`payment.status === 'pending'`) — used to
 * open Razorpay Checkout, both right after `checkout()` and again later
 * from the order-detail page if the customer closed the popup without
 * paying the first time (the backend hands back the SAME `orderId` each
 * time; Razorpay accepts multiple payment attempts per order). `keyId` is
 * Razorpay's publishable key id — safe to expose, not a secret. */
export interface RazorpayOrderInfo {
  orderId: string;
  /** Paise, matching what Razorpay's own `Checkout` options expect directly. */
  amount: number;
  currency: string;
  keyId: string;
}

/** What `RazorpayCheckoutService`'s `handler` callback hands back after a
 * payment attempt — forwarded as-is to `PaymentService.verifyRazorpayPayment`. */
export interface VerifyRazorpayPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface OrderSummary {
  uuid: string;
  orderNumber: string;
  amount: number;
  discount: number;
  subTotal: number;
  deliveryFee: number;
  totalAmount: number;
  markOrderAsGift: boolean;
  /** Rolled up from `order_items.item_status` across every seller group —
   * see `recomputeOrderStatus()`: 'placed' | 'processing' | 'shipped' |
   * 'partially_shipped' | 'delivered' | 'cancelled' | 'returned'. */
  orderStatus: string;
  /** 'pending' | 'success' — COD flips to 'success' automatically once a
   * seller marks a sub-order 'delivered' (cash collected); 'manual' needs
   * an admin's `confirm-payment` action. */
  paymentStatus: string;
  orderDateTime: string;
  createdAt: string;
  /** Set together, only once the customer has actually cancelled (see
   * `POST /:orderUuid/cancel`, which now requires a `reason` — added
   * 2026-09-13 alongside `orders.cancel_reason`/`cancelled_at`). Both
   * `null` until then. */
  cancelReason: string | null;
  cancelledAt: string | null;
  /** When the customer asked for a call back, while that request is open. */
  supportRequestedAt: string | null;
}

/** Per-item lifecycle, from `order_items.item_status` — one row per
 * physical unit, not per cart line (`0055_create_order_items.sql`'s header
 * comment): 'pending' | 'confirmed' | 'shipped' | 'delivered' |
 * 'cancelled' | 'return_requested' | 'return_approved' | 'returned' |
 * 'replacement_requested' | 'replaced'. */
export type OrderItemStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  // The return parcel reached the seller; the refund has started.
  | 'return_received'
  | 'returned'
  | 'replacement_requested'
  | 'replaced'
  // Never reached the customer (manufest_be deliveryIssues.service.js):
  // the parcel went back to the seller (RTO), or the courier lost it.
  | 'rto_received'
  | 'rto_completed'
  | 'lost';

/** `GET /customer/orders/:orderUuid/returns` — one per return raised
 * (manufest_be returns.service.js). REQUESTED -> APPROVED (a courier picks
 * it up) or REJECTED (`adminNote` says why) -> RECEIVED (back with the
 * seller, refund started) -> COMPLETED. */
export interface ReturnRequest {
  uuid: string;
  orderItemUuid: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'COMPLETED';
  reason: string;
  adminNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  pickup: {
    courierName: string | null;
    awb: string | null;
    trackingUrl: string | null;
    pickupScheduledDate: string | null;
    dispatchStatus: string | null;
  } | null;
  receivedAt: string | null;
  completedAt: string | null;
}

export type ReturnMediaType = 'video' | 'image';

/** An uploaded evidence file, attached to the return when it's raised. */
export interface ReturnMediaUpload {
  uuid: string;
  mediaType: ReturnMediaType;
  sizeBytes: number;
}

/** The customer's "I didn't receive this" report on a delivered item. */
export interface NotReceivedReport {
  status: 'OPEN' | 'REFUNDED' | 'DISMISSED';
  reportedAt: string;
  note: string | null;
  resolvedAt: string | null;
  /** Manufest's reply, shown to the customer. */
  resolutionNote: string | null;
}

export interface OrderItem {
  uuid: string;
  product: {
    uuid: string;
    productName: string;
    sku: string;
    /** `order_items.product_primary_image` — a snapshot taken at checkout
     * time (not re-resolved live), same private productMediaStorage URL
     * every other media field in this app returns. Resolve through
     * `ProductService.mediaSrc()`. `null` if the variant had no image yet
     * when this order was placed. */
    primaryImage: string | null;
  };
  variant: { variantName: string | null; size: string | null; colorHex: string | null };
  unitSku: string | null;
  unitPrice: number;
  gstPercent: number;
  gstAmount: number;
  totalPrice: number;
  itemStatus: OrderItemStatus;
  cancelledAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  notReceived?: NotReceivedReport | null;
  /** Until when "I didn't receive this" is offered (48 hours after
   * delivery), or null when it isn't. */
  notReceivedReportableUntil?: string | null;
  /** The customer's own review of this item (one per order item), or
   * `null` if not reviewed yet — order detail only (added 2026-10-07). */
  review: { rating: number } | null;
}

export interface OrderSellerGroup {
  uuid: string;
  seller: { uuid: string; name: string };
  /** Rolled up from this group's own items — see
   * `recomputeOrderSellerGroupStatus()`: same value set as `OrderSummary`'s
   * `orderStatus` plus 'placed' as the initial state. */
  subOrderStatus: string;
  subTotalAmount: number;
  commissionAmount: number;
  payoutAmount: number;
  items: OrderItem[];
}

export interface OrderShippingAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
}

export interface OrderPayment {
  method: PaymentMethod;
  /** 'pending' | 'success' | 'failed' | 'refunded' | 'partially_refunded' —
   * the last two only became reachable once `attemptGatewayRefund()`
   * (backend, 2026-09) started driving refunds through Razorpay/manual
   * bank transfer and rolling the result up onto `payments.payment_status`
   * (added 2026-09-22 alongside `refundedAmount` below). */
  status: string;
  amount: number;
  /** Set only once a `razorpay` payment attempt actually failed (signature
   * mismatch, gateway declined, or the order was abandoned) — `null`
   * otherwise, including for a still-`pending` payment. */
  failureReason: string | null;
  /** Sum of every `order_items.total_price` whose refund has actually
   * completed (`refunds.refund_status === 'refunded'`) — NOT the amount
   * merely requested or approved. 0 until a refund is fully settled, added
   * 2026-09-22 on every order-detail response (`list_by_id`, `checkout`,
   * `cancel`, `return-request`, `return-approve`). */
  refundedAmount: number;
}

export interface OrderDetail extends OrderSummary {
  shippingAddress: OrderShippingAddress;
  payment: OrderPayment | null;
  /** See `RazorpayOrderInfo`'s own doc comment — `null` unless this order
   * is an unpaid `razorpay` order right now. */
  razorpayOrder: RazorpayOrderInfo | null;
  sellerGroups: OrderSellerGroup[];
}

/** Seller-entered parcels use the manual set; courier-booked (Shiprocket)
 * parcels also report ready_to_ship, pickup_scheduled, undelivered and
 * cancelled. */
export type DispatchStatus =
  | 'pending'
  | 'ready_to_ship'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'undelivered'
  | 'delivered'
  | 'failed'
  | 'rto'
  | 'cancelled';

export interface ShipmentTrackingEvent {
  location: string | null;
  remarks: string | null;
  status: string;
  eventDatetime: string;
}

/** `GET /customer/shipments/order-items/:orderItemUuid` (added 2026-09-23,
 * read-only mirror of the seller-entered parcel — see
 * `manufest_be/src/modules/shipments/shipments.api.js`'s header comment).
 * Either typed in by the seller (`provider: 'manual'`) or booked through
 * Shiprocket (`provider: 'shiprocket'` — live courier updates, and a
 * public `trackingUrl`). One parcel per physical unit (`order_items` row),
 * independent of `itemStatus`. */
export interface Shipment {
  uuid: string;
  orderItemUuid: string;
  provider: 'manual' | 'shiprocket';
  courierPartner: string | null;
  trackingNumber: string | null;
  /** Courier's public tracking page (Shiprocket parcels). */
  trackingUrl: string | null;
  dispatchStatus: DispatchStatus;
  dispatchDate: string | null;
  deliveredDate: string | null;
  estimatedDeliveryDate: string | null;
  events: ShipmentTrackingEvent[];
}
