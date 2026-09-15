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
  | 'returned'
  | 'replacement_requested'
  | 'replaced';

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
  status: string;
  amount: number;
  /** Set only once a `razorpay` payment attempt actually failed (signature
   * mismatch, gateway declined, or the order was abandoned) — `null`
   * otherwise, including for a still-`pending` payment. */
  failureReason: string | null;
}

export interface OrderDetail extends OrderSummary {
  shippingAddress: OrderShippingAddress;
  payment: OrderPayment | null;
  /** See `RazorpayOrderInfo`'s own doc comment — `null` unless this order
   * is an unpaid `razorpay` order right now. */
  razorpayOrder: RazorpayOrderInfo | null;
  sellerGroups: OrderSellerGroup[];
}
