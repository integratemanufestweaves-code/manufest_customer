import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../core/services/cart.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { ProductService } from '../../core/services/product.service';
import { Address, AddressRequest } from '../../core/models/customer.models';
import { OrderDetail, PaymentMethod } from '../../core/models/order.models';
import { CartItem } from '../../core/models/cart.models';

/**
 * `POST /customer/orders/checkout` (`orders.api.js`) — by default converts
 * the whole server-side cart into an order, but accepts an optional
 * `cartItemUuids` subset (2026-09-13) so a customer can check out only
 * some of what's in their cart. `CartComponent`'s selection checkboxes
 * hand that subset over via `CartService.setCheckoutSelection()` before
 * routing here; `selectedUuids` below is a one-time snapshot of that at
 * load time (checkout has its own fixed item list once started — it
 * shouldn't silently change if something else touches the cart signal
 * mid-flow). `null` means "no selection was made" (e.g. a direct link to
 * `/checkout`), which this page treats the same way the backend does when
 * `cartItemUuids` is omitted: the whole cart.
 *
 * Only two payment methods exist at all (no gateway integrated yet, see
 * `orders.api.js`'s own header comment) — `cod` (no confirmation step) and
 * `manual` (offline/bank-transfer, an admin confirms it later via the
 * admin console). Delivery address reuses the same address book §4b
 * already built (`CustomerService.listAddresses()`), but — like every
 * other e-commerce checkout — also lets a customer add a new address
 * inline, right here, instead of bouncing them to `/account` and back
 * (added 2026-09-13; the "Add one" link that used to send customers away
 * mid-checkout is gone). The selected address is shown as a highlighted,
 * radio-selected card in "Delivery address", which doubles as the
 * confirmation step — no separate "review" screen exists, matching how
 * little else this checkout flow has (single page, no wizard steps).
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly customerService = inject(CustomerService);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);
  private readonly razorpayCheckout = inject(RazorpayCheckoutService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** `null` = checking out the whole cart; otherwise the exact uuids to
   * send as `cartItemUuids`. Snapshotted once in `ngOnInit`. */
  private selectedUuids: string[] | null = null;

  readonly checkoutItems = computed<CartItem[]>(() => {
    const items = this.cartService.cart().items;
    if (this.selectedUuids == null) return items;
    const set = new Set(this.selectedUuids);
    return items.filter((item) => set.has(item.uuid));
  });
  readonly checkoutItemCount = computed(() => this.checkoutItems().length);
  readonly checkoutSubtotal = computed(() => this.checkoutItems().reduce((sum, item) => sum + (item.lineTotal || 0), 0));

  /** Same check the server makes on `POST /customer/orders/checkout`
   * (`INSUFFICIENT_STOCK`) — checked here too so "Place order" refuses to
   * even try instead of the customer filling in an address, clicking it,
   * and only then learning from a raw API error that something in their
   * selection sold out. Cart page already keeps a stock-issue item out of
   * `cartItemUuids` in the first place, but this page can still be reached
   * with one selected (a direct `/checkout` link with no prior selection,
   * or stock dropping to 0 for an item picked *before* this page loaded),
   * so it's checked again here rather than assumed. */
  hasStockIssue(item: CartItem): boolean {
    return item.quantity > item.quantityAvailable;
  }
  isOutOfStock(item: CartItem): boolean {
    return item.quantityAvailable <= 0;
  }
  readonly hasAnyStockIssue = computed(() => this.checkoutItems().some((item) => this.hasStockIssue(item)));

  readonly addresses = signal<Address[]>([]);
  readonly addressesLoading = signal(true);
  selectedAddressUuid: string | null = null;

  /** Inline "add a new address" form — shown either because the customer
   * has none yet, or because they clicked "+ Add new address" from an
   * existing list (both paths land here; see this component's header
   * comment). */
  readonly showAddressForm = signal(false);
  addressForm: AddressRequest = this.blankAddressForm();
  readonly addressSaving = signal(false);
  readonly addressFormError = signal<string | null>(null);

  paymentMethod: PaymentMethod = 'cod';
  markOrderAsGift = false;

  readonly placingOrder = signal(false);
  readonly placeOrderError = signal<string | null>(null);

  private readonly brokenThumbnails = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.selectedUuids = this.cartService.checkoutSelection();
    this.cartService.refresh();
    this.loading.set(false);
    this.loadAddresses();
  }

  private loadAddresses(preferredUuid?: string): void {
    this.addressesLoading.set(true);
    this.customerService.listAddresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        const preferred = preferredUuid ? addresses.find((a) => a.uuid === preferredUuid) : undefined;
        const defaultAddress = preferred || addresses.find((a) => a.isDefault) || addresses[0];
        this.selectedAddressUuid = defaultAddress?.uuid || null;
        this.addressesLoading.set(false);
        this.showAddressForm.set(addresses.length === 0);
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load your saved addresses.');
        this.addressesLoading.set(false);
      },
    });
  }

  private blankAddressForm(): AddressRequest {
    return { label: '', recipientName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: 'IN', isDefault: false };
  }

  startAddAddress(): void {
    this.addressForm = this.blankAddressForm();
    this.addressFormError.set(null);
    this.showAddressForm.set(true);
  }

  cancelAddAddress(): void {
    this.showAddressForm.set(false);
  }

  saveNewAddress(): void {
    const f = this.addressForm;
    if (!f.recipientName || !f.phone || !f.line1 || !f.city || !f.postalCode || f.countryCode.length !== 2) {
      this.addressFormError.set('Fill in recipient, phone, address line 1, city, postal code, and a 2-letter country code.');
      return;
    }
    this.addressFormError.set(null);
    this.addressSaving.set(true);

    this.customerService.createAddress(f).subscribe({
      next: (created) => {
        this.addressSaving.set(false);
        this.showAddressForm.set(false);
        this.loadAddresses(created.id);
      },
      error: (err) => {
        this.addressFormError.set(err?.message || 'Could not save this address.');
        this.addressSaving.set(false);
      },
    });
  }

  formatPrice(n: number): string {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  thumbnailSrc(item: CartItem): string | null {
    if (this.brokenThumbnails().has(item.uuid)) return null;
    return this.productService.mediaSrc(item.variant.thumbnail?.url);
  }

  onThumbnailError(item: CartItem): void {
    this.brokenThumbnails.update((set) => new Set(set).add(item.uuid));
  }

  /** True once the order exists (checkout() already succeeded) and
   * Razorpay Checkout is open/being verified — kept distinct from
   * `placingOrder` so the button label can say "Processing payment…"
   * instead of "Placing order…" during this phase. */
  readonly processingPayment = signal(false);

  placeOrder(): void {
    if (!this.selectedAddressUuid) {
      this.placeOrderError.set('Choose a delivery address first.');
      return;
    }
    this.placeOrderError.set(null);
    this.placingOrder.set(true);

    this.orderService
      .checkout({
        addressUuid: this.selectedAddressUuid,
        paymentMethod: this.paymentMethod,
        markOrderAsGift: this.markOrderAsGift,
        ...(this.selectedUuids ? { cartItemUuids: this.selectedUuids } : {}),
      })
      .subscribe({
        next: (order) => this.handleOrderCreated(order),
        error: (err) => {
          // This shouldn't normally fire — `hasAnyStockIssue()` already
          // blocks the button — but it's still reachable if stock changes
          // in the moment between this page loading and the click (someone
          // else buys the last unit). `INSUFFICIENT_STOCK` gets a message
          // in this page's own voice rather than the raw API text (which
          // reads as backend-speak, e.g. "Only 0 unit(s) available for
          // this variant right now" — accurate, but not how the rest of
          // this page talks); refreshing the cart also means the stale
          // `quantityAvailable` this page loaded with self-corrects, so a
          // retry after going back to the cart reflects the real stock.
          if (err?.code === 'INSUFFICIENT_STOCK') {
            this.placeOrderError.set('Insufficient stock — one of the items in this order sold out just now. Go back to your cart to review it.');
            this.cartService.refresh();
          } else {
            this.placeOrderError.set(err?.message || 'Could not place your order.');
          }
          this.placingOrder.set(false);
        },
      });
  }

  /** The order row exists either way by this point (and its cart lines are
   * already gone server-side) — a razorpay order just isn't PAID yet, so
   * this branches into opening Checkout.js rather than navigating away
   * immediately. */
  private handleOrderCreated(order: OrderDetail): void {
    if (order.razorpayOrder) {
      this.completeRazorpayPayment(order);
      return;
    }
    this.finishCheckout(order);
  }

  private finishCheckout(order: OrderDetail): void {
    this.placingOrder.set(false);
    this.processingPayment.set(false);
    // Only the checked-out lines were removed server-side — a partial
    // selection can leave items behind, so refresh from the server instead
    // of assuming the cart is now empty.
    this.cartService.clearCheckoutSelection();
    this.cartService.refresh();
    this.router.navigate(['/orders', order.uuid]);
  }

  private completeRazorpayPayment(order: OrderDetail): void {
    this.placingOrder.set(false);
    this.processingPayment.set(true);
    const address = this.addresses().find((a) => a.uuid === this.selectedAddressUuid);

    this.razorpayCheckout.open(order.razorpayOrder!, { name: address?.recipientName, contact: address?.phone }).then((result) => {
      if (result.outcome === 'dismissed') {
        // Nothing failed — the order is just still unpaid. The order-detail
        // page offers a "Complete payment" button against this same
        // gateway order for exactly this case.
        this.finishCheckout(order);
        return;
      }

      this.paymentService.verifyRazorpayPayment(order.uuid, result.payload).subscribe({
        next: (updated) => this.finishCheckout(updated),
        // A failed verification (bad signature, gateway declined, not yet
        // captured) still leaves a real, retryable order behind — surface
        // that from order-detail rather than stranding the customer on
        // this page with no order to show for it.
        error: () => this.finishCheckout(order),
      });
    });
  }
}
