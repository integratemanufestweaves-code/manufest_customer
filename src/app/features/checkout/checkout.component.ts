import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { ProductService } from '../../core/services/product.service';
import { AnalyticsItem, AnalyticsService } from '../../core/services/analytics.service';
import { Address, AddressRequest } from '../../core/models/customer.models';
import { OrderDetail, PaymentMethod } from '../../core/models/order.models';
import { CartItem } from '../../core/models/cart.models';
import { formatPrice } from '../../core/utils/format-price';
import { AddressFieldErrors, trimAddressForm, validateAddressForm } from '../../core/utils/address-validation';

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
function toAnalyticsItem(item: CartItem): AnalyticsItem {
  return {
    productUuid: item.product.uuid,
    name: item.product.productName,
    price: item.currentPrice,
    variant: item.variant.variantName,
    quantity: item.quantity,
  };
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly customerService = inject(CustomerService);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);
  private readonly razorpayCheckout = inject(RazorpayCheckoutService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);
  /** begin_checkout fires once, when the cart lines first arrive. */
  private checkoutTracked = false;

  constructor() {
    effect(() => {
      const items = this.checkoutItems();
      if (this.checkoutTracked || !items.length) return;
      this.checkoutTracked = true;
      this.analytics.beginCheckout(this.checkoutSubtotal(), items.map(toAnalyticsItem));
    });
  }

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** "Good to know" points under Place order — add a line here to show
   * another point. */
  readonly orderNotes: string[] = [
    'Please record a video while opening the parcel — it speeds up any return/replacement request.',
  ];

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
  // Whole paise, same as the cart page's selectedSubtotal.
  readonly checkoutSubtotal = computed(
    () => this.checkoutItems().reduce((paise, item) => paise + Math.round((item.lineTotal || 0) * 100), 0) / 100,
  );

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
  /** Set while the form is editing a saved address (null = adding a new one). */
  readonly editingAddressUuid = signal<string | null>(null);
  addressForm: AddressRequest = this.blankAddressForm();
  readonly addressSaving = signal(false);
  readonly addressFormError = signal<string | null>(null);
  readonly addressFieldErrors = signal<AddressFieldErrors>({});

  /** COD and bank transfer are switched off for launch (2026-09-29) —
   * online payment via Razorpay only. The backend still accepts both, so
   * flipping this back to `true` is the only change needed to re-offer them. */
  readonly offlinePaymentsEnabled = false;
  paymentMethod: PaymentMethod = 'razorpay';
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

  /** The receiver's phone starts as the customer's own verified mobile
   * number (they can overwrite it when the parcel goes to someone else).
   * The label starts as "Home"; the customer can change it to Work etc. */
  private blankAddressForm(): AddressRequest {
    const phone = this.auth.currentUser()?.mobileNumber || '';
    return { label: 'Home', recipientName: '', phone, line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: 'IN', isDefault: false };
  }

  startAddAddress(): void {
    this.addressForm = this.blankAddressForm();
    this.editingAddressUuid.set(null);
    this.addressFormError.set(null);
    this.addressFieldErrors.set({});
    this.showAddressForm.set(true);
  }

  startEditAddress(address: Address): void {
    this.addressForm = {
      label: address.label || '',
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      state: address.state || '',
      postalCode: address.postalCode,
      // India-only, same as the add form's read-only Country field.
      countryCode: 'IN',
      isDefault: address.isDefault,
    };
    this.editingAddressUuid.set(address.uuid);
    this.addressFormError.set(null);
    this.addressFieldErrors.set({});
    this.showAddressForm.set(true);
  }

  cancelAddAddress(): void {
    this.showAddressForm.set(false);
    this.editingAddressUuid.set(null);
  }

  saveNewAddress(): void {
    const f = trimAddressForm(this.addressForm);
    this.addressForm = f;
    const fieldErrors = validateAddressForm(f);
    this.addressFieldErrors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      this.addressFormError.set('Please fix the highlighted fields.');
      return;
    }
    this.addressFormError.set(null);
    this.addressSaving.set(true);

    // Editing keeps that address selected afterwards; adding selects the new one.
    const editingUuid = this.editingAddressUuid();
    const save$ = editingUuid
      ? this.customerService.updateAddress(editingUuid, f).pipe(map(() => editingUuid))
      : this.customerService.createAddress(f).pipe(map((created) => created.id));
    save$.subscribe({
      next: (uuid) => {
        this.addressSaving.set(false);
        this.showAddressForm.set(false);
        this.editingAddressUuid.set(null);
        this.loadAddresses(uuid);
      },
      error: (err) => {
        this.addressFormError.set(err?.message || 'Could not save this address.');
        this.addressSaving.set(false);
      },
    });
  }

  formatPrice(n: number): string {
    return formatPrice(n);
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

  /** COD/bank transfer (when enabled) are real orders straight away. An
   * online checkout is not an order until Razorpay confirms the payment, so
   * this opens Checkout.js instead of navigating away. */
  private handleOrderCreated(order: OrderDetail): void {
    if (order.razorpayOrder) {
      this.completeRazorpayPayment(order);
      return;
    }
    this.finishCheckout(order);
  }

  private finishCheckout(order: OrderDetail): void {
    // Before the cart refresh below drops the checked-out lines.
    this.analytics.purchase(order.uuid, order.totalAmount, this.checkoutItems().map(toAnalyticsItem));
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
        this.settleUnconfirmedPayment(order);
        return;
      }

      this.paymentService.verifyRazorpayPayment(order.uuid, result.payload).subscribe({
        // 200 = placed, 202 = paid but awaiting Razorpay's confirmation
        // (payment_processing) — both are shown on the order page.
        next: (updated) => this.finishCheckout(updated),
        // Verification failed (bad signature, declined) — let the backend
        // settle it against Razorpay the same way as a closed popup.
        error: () => this.settleUnconfirmedPayment(order),
      });
    });
  }

  /** Popup closed or verification failed: the backend checks with Razorpay.
   * Anything that ended up placed or still settling goes to the order page;
   * otherwise no order was placed — stay here with the cart untouched (online
   * checkout never cleared it) so the customer can simply try again. */
  private settleUnconfirmedPayment(order: OrderDetail): void {
    this.paymentService.dismissRazorpayPayment(order.uuid).subscribe({
      next: (settled) => {
        if (settled.orderStatus === 'payment_failed' || settled.orderStatus === 'awaiting_payment') {
          this.showNotPlaced();
        } else {
          this.finishCheckout(settled);
        }
      },
      error: () => this.showNotPlaced(),
    });
  }

  private showNotPlaced(): void {
    this.processingPayment.set(false);
    this.placingOrder.set(false);
    this.cartService.refresh();
    this.placeOrderError.set('Payment was not completed, so your order was not placed. Your cart is unchanged. You can try again.');
  }
}
