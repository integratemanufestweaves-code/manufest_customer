import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../core/services/cart.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import { Address, AddressRequest } from '../../core/models/customer.models';
import { PaymentMethod } from '../../core/models/order.models';
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
        next: (order) => {
          this.placingOrder.set(false);
          // Only the checked-out lines were removed server-side — a partial
          // selection can leave items behind, so refresh from the server
          // instead of assuming the cart is now empty.
          this.cartService.clearCheckoutSelection();
          this.cartService.refresh();
          this.router.navigate(['/orders', order.uuid]);
        },
        error: (err) => {
          this.placeOrderError.set(err?.message || 'Could not place your order.');
          this.placingOrder.set(false);
        },
      });
  }
}
