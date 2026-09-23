# Return / Refund (Razorpay) — Frontend Integration Notes

Started 2026-09-22. Tracks frontend work across `manufest_customer`,
`manufest_seller`, and `manufest_admin` against the backend's order-return-
request → admin-approval → Razorpay-refund flow
(`manufest_be/src/modules/orders/orders.api.js`), plus (2026-09-23) the new
per-item `shipments` module and return-window enforcement.

**2026-09-22 pass:** built against a `manufest_be` snapshot another
developer was still actively working in — no backend files touched that
round, everything below from that date is frontend-only.

**2026-09-23 pass:** the user pulled that developer's finished work and
said backend edits are OK now. `manufest_be` WAS touched this round — see
"2026-09-23 backend change" below — everything else stayed frontend-only.

Courier/delivery-partner (Shiprocket) integration is explicitly out of
scope everywhere in this pass — pickup scheduling etc. will get its own
APIs/screens later. The `shipments` module below is unrelated manual
courier/tracking entry (a seller types in a courier name + tracking number
by hand), not Shiprocket automation.

---

## Status — 2026-09-22 pass (return/refund flow)

- **manufest_customer** — done. See below.
- **manufest_admin** — done. Built from scratch (no order/payment/refund UI
  existed there at all before this pass): order list (`/admin/orders`),
  order detail (`/admin/orders/:orderUuid`, with bulk + single
  return-approve, replacement-approve, restock/damage return-decision, and
  manual-payment confirmation actions), refunds list with mark-refunded
  (`/admin/refunds`), and a Razorpay balance widget on that same page. New
  sidebar entries: "Orders", "Refunds".
- **manufest_seller** — done, **read-only** (sellers have no
  return/refund/cancel authority server-side — `sellerRouter` in
  `orders.api.js` only exposes list/detail/fulfillment-status-update, and
  fulfillment status-update itself was left out of this pass's scope on
  purpose, see below). Replaced the `Orders` placeholder with a real order
  list (`/seller/orders`) and detail (`/seller/orders/:orderSellerGroupUuid`)
  showing item status including return/replacement/refund state — no
  action buttons anywhere in this feature.

---

## 2026-09-23 pass — shipments (per-item) + return-window enforcement

`manufest_be` shipped two new things since the 2026-09-22 pass (see its
`git log`: `8de5c57` → `5a6b048` "order changes" → `c0a58c0` "schema
changes"):

1. **Return-window enforcement**: both return-request routes now reject a
   return once `RETURN_WINDOW_DAYS` (default 7) has passed since
   `order_items.delivered_at` — `RETURN_WINDOW_EXPIRED` on an explicit
   single-item/named-item request, silently excluded (not an error) from
   an implicit "return everything delivered" call.
2. **Shipments module reworked to per-item** (`shipments.api.js`,
   **breaking change** — the old group-level `PUT`/`POST
   .../tracking-events` routes were removed): every `order_items` row now
   ships as its own parcel, tracked independently. New routes are all
   `.../order-items/:orderItemUuid` (seller: upsert + add-tracking-event +
   get; admin: read-only mirror) plus a list route per
   `orderSellerGroupUuid` returning one entry per item (`shipment: null`
   for a unit with no parcel yet).

### 2026-09-23 backend change (manufest_be — touched this round, with the user's explicit OK)

Added a **customer-facing read route** for shipments —
`GET /api/v1/customer/shipments/order-items/:orderItemUuid`
(`shipments.api.js`'s new `customerRouter`, mounted in
`customer/customer.routes.js`). Before this, only seller (write) and admin
(read-only) routes existed — a customer had no way to see their own
order's tracking info at all. Ownership-checked via
`orders.ref_id_customers`, otherwise an exact read-only mirror of the
admin item route. Also updated `.claude/knowledge/02-api-reference.md` to
document it, matching this repo's existing convention of keeping that doc
in sync with the code.

### Frontend — what changed

- **manufest_customer**: `order.models.ts` gained `Shipment`/
  `ShipmentTrackingEvent`/`DispatchStatus`; new `ShipmentService`
  (`GET /customer/shipments/order-items/:orderItemUuid`). Order-detail page
  gained a per-item "Track package" toggle (shown for `shipped`/`delivered`
  items, fetched lazily on click — not eagerly for the whole order) showing
  courier/tracking/status/ETA/event history, or "No tracking info yet."
  Also added client-side return-window awareness: the per-item "Return"
  button and the header "Return order" button now both require
  `deliveredAt` to be within `RETURN_WINDOW_DAYS` (hardcoded to 7 in
  `order-detail.component.ts`, matching the backend default — there's no
  API to read the configured value, so this is cosmetic gating only; the
  backend's own check is what's actually authoritative). A delivered item
  past the window shows "Return window closed" instead of the button.
- **manufest_seller**: new `shipment.models.ts` + `ShipmentService`
  (list/upsert/add-tracking-event, all three routes this app can actually
  call). Order-detail page gained a per-item shipment section: shows the
  existing parcel (courier, tracking number, dispatch status, ETA, event
  history) or "No parcel created yet.", with "Create parcel"/"Edit parcel"
  and "Add tracking event" forms. This is the one place in the seller
  app's Orders feature that ISN'T read-only — everything else there
  (order/return/refund state) still is, per the 2026-09-22 pass's scope
  decision.
- **manufest_admin**: new `shipment.models.ts` + `ShipmentAdminService`
  (`listForGroup` only — admin has no write route). Order-detail page
  fetches one shipments list per seller group on the order (in parallel,
  non-fatal on failure) and shows each item's parcel info read-only,
  alongside the existing return/refund actions.

---

## manufest_customer — what changed

- `core/models/order.models.ts` — added `OrderPayment.refundedAmount`
  (new backend field, sum of actually-completed refunds; 0 until a refund
  fully settles — requested/approved-but-not-yet-refunded amounts don't
  count).
- `core/services/order.service.ts` — `requestReturn()` now calls the new
  bulk `POST /customer/orders/:orderUuid/return-request` instead of the
  old single-item `.../order-items/:orderItemUuid/return-request`. Pass
  one item uuid for a single-item return, omit `orderItemUuids` entirely
  for a whole-order return. Returns the full refreshed `OrderDetail`
  directly (the old single-item route only returned `{status}}`, which
  meant a manual reload after every return request — no longer needed).
- `features/order-detail/` — added a header-level "Return order" action
  (whole order, mirrors the existing "Cancel order" inline-panel pattern)
  alongside the existing per-item "Return" action (now backed by the bulk
  endpoint with a single item uuid). Added a short status note under
  return-related item statuses ("Awaiting approval" / "Approved — refund
  is being processed" / "Return complete") and a refunded-amount line on
  the Payment card when `payment.refundedAmount > 0`.
- `features/orders/` — order list cards now show a small "Refunded" /
  "Partially refunded" chip when `paymentStatus` is one of those (these
  enum values were previously dead — this pass is the first time they can
  actually appear).
- Replacement requests are untouched functionally (separate, unaffected
  backend route) — the component code was reshaped slightly (own signals
  instead of a shared `actionForm` with a `kind` field) purely so the new
  return-panel logic didn't have to keep sharing state with it.

---

## manufest_admin — what was built

- `core/models/order-admin.models.ts`, `core/services/order-admin.service.ts`
  (`/admin/orders/*`), `core/services/payments-admin.service.ts`
  (`/admin/payments/*`).
- `features/orders/orders-list/` — paginated table, status tabs
  (placed/processing/partially_shipped/shipped/delivered/cancelled/returned).
- `features/orders/order-detail/` — shipping address, payment (incl.
  `refundedAmount`), and every seller-group's items with contextual
  per-item actions: "Confirm payment" (manual method, pending item),
  "Approve return" (`return_requested`), "Restock"/"Mark damaged"
  (`return_approved` — the inventory-disposition step, separate from the
  refund itself), "Approve replacement" (`replacement_requested`). A
  header-level "Approve all pending returns" runs the bulk endpoint when
  any item is `return_requested`.
- `features/refunds/refunds-list/` — every refund across every order
  (the backend route has no `orderUuid` filter, so this can't be scoped
  to one order — order detail links out here instead of duplicating
  "mark refunded" there), with a Razorpay balance widget at the top.
  "Mark refunded" only shows for `bank_transfer` + `pending` rows — a
  `razorpay` refund resolves only via webhook, never from this button.
- Sidebar: added "Orders", "Refunds" nav entries.

## manufest_seller — what was built, and one thing deliberately NOT built

- `core/models/order.models.ts`, `core/services/order.service.ts`
  (`/seller/orders/*`, read-only — `list()`/`getDetail()` only).
- `features/orders/orders-list/` — paginated table of this seller's own
  `order_seller_groups` rows, status filter.
- `features/orders/order-detail/` — order + shipping + payment context,
  this seller's own items with status (including return/replacement/refund
  states, shown as plain-language notes since the seller can't act on any
  of them), and their own subtotal/commission/payout. **No action
  buttons** — not even fulfillment status-update (`PATCH
  /:orderSellerGroupUuid/status`, processing/shipped/delivered), even
  though that route already exists and predates this pass. Left out
  deliberately to keep this pass scoped to "read-only order visibility for
  return/refund" as agreed — a natural next step, not done here.
- Sidebar already had an "Orders" entry pointing at the placeholder route;
  only the route's target component changed.

---

## Open backend-facing questions / possible follow-ups

Not blocking anything built so far — just flagging for whenever
`manufest_be` work picks back up:

1. **`GET /seller/orders/list_by_id/:orderSellerGroupUuid` returns the
   FULL order (`loadOrderDetail()`), including every OTHER seller's own
   group on the same multi-seller order** — not scoped down to just the
   caller's own group. The route only checks that the requested
   `orderSellerGroupUuid` belongs to the calling seller; it doesn't filter
   the *response*. That response includes other sellers'
   `commissionAmount`/`payoutAmount`/items, which a given seller has no
   business seeing. The seller frontend built this pass filters to the
   caller's own group client-side (`OrderDetailComponent` in
   `manufest_seller`) and never renders the rest, but the backend still
   sends it over the wire to that seller's browser — worth scoping
   `sellerGroups` down to just the caller's own group server-side
   whenever `orders.api.js` is next touched.
2. **Customer never sees per-refund detail**, only the aggregate
   `payment.refundedAmount`. `GET /admin/payments/refunds/list` exists but
   is admin-only. If product wants a customer-facing "refund history" (per
   item: requested → approved → refunded, with dates), that needs a new
   customer-scoped read endpoint — nothing today exposes `refunds` rows to
   the customer who owns them.
3. **`customer_accounts` (bank details) has a backend API
   (`/customer/bank-account`) with zero frontend consumption anywhere in
   `manufest_customer`.** This matters for the `bank_transfer` refund
   fallback path (`attemptGatewayRefund()` falls back to it when the
   original payment wasn't a successful Razorpay payment) — if a refund
   ever needs to go out by bank transfer and the customer has never added
   bank details, there's currently no UI prompting them to. Worth deciding
   whether that's an admin-support-assisted flow (admin asks the customer
   off-platform, enters it for them) or needs a self-serve "Add bank
   details" screen before this becomes a real gap in production.
4. **`order_items.item_status` has two enum values reserved in the column
   comment but unused by any current route**: `replacement_approved`,
   `rejected`. Not blocking — just noting so nobody assumes frontend
   should be rendering states the backend never sets today.
5. **No API exposes `RETURN_WINDOW_DAYS`'s configured value.** The
   customer frontend hardcodes `7` (matching the backend's own default) to
   decide client-side whether to show the "Return"/"Return order" buttons
   at all — if that env var is ever changed in production, the two will
   drift until someone remembers to update the frontend constant too. A
   tiny public config endpoint (or including the deadline directly on each
   `OrderItem`, e.g. `returnEligibleUntil`) would remove the need to keep
   these in sync by hand.
6. **`order-lifecycle` email notifications (`notifyOrderEvent`, added
   2026-09-23) are logging-only** — `email.worker.js` has no real provider
   wired up yet (pre-existing, same as password-reset email). Not a
   frontend concern, just noting so nobody's surprised customers aren't
   actually receiving "your return was approved" emails yet in any
   environment.
