/**
 * Shapes for manufest_be's `customer-notifications` module
 * (`src/modules/customer-notifications/customerNotifications.api.js`,
 * mounted `/api/v1/customer/notifications`). `BACK_IN_STOCK` is the only
 * `type` that exists today (fired by the backend's `stockNotify.service.js`
 * when a wishlisted/notify-requested product's stock goes from 0 to >0) —
 * `type` is a plain string, not a closed union, since the backend treats
 * it the same way (room for a future notification type with no schema
 * change on either side).
 */
export interface CustomerNotification {
  uuid: string;
  type: string;
  title: string;
  message: string | null;
  /** Relative path (e.g. `/product/:uuid`) — resolve with `routerLink`,
   * never bind as raw HTML. */
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}
