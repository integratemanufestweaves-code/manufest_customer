import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CheckoutComponent } from './checkout.component';
import { CartService } from '../../core/services/cart.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { AuthService } from '../../core/services/auth.service';
import { CartItem, CartView } from '../../core/models/cart.models';
import { Address } from '../../core/models/customer.models';
import { OrderDetail } from '../../core/models/order.models';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    uuid: overrides.uuid ?? 'item-1',
    quantity: overrides.quantity ?? 1,
    priceAtAdd: overrides.priceAtAdd ?? 1000,
    currentPrice: overrides.currentPrice ?? 1000,
    lineTotal: overrides.lineTotal ?? 1000,
    quantityAvailable: overrides.quantityAvailable ?? 5,
    variant: overrides.variant ?? { uuid: 'variant-1', variantName: 'Red / M', colorHex: '#ff0000', thumbnail: null },
    product: overrides.product ?? { uuid: 'product-1', productName: 'Kanchipuram Silk Saree' },
  };
}

function makeCart(items: CartItem[]): CartView {
  return { items, itemCount: items.length, total: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) };
}

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    uuid: overrides.uuid ?? 'addr-1',
    label: overrides.label ?? 'Home',
    recipientName: overrides.recipientName ?? 'Jane Doe',
    phone: overrides.phone ?? '9999999999',
    line1: overrides.line1 ?? '123 Main St',
    line2: overrides.line2 ?? null,
    city: overrides.city ?? 'Chennai',
    state: overrides.state ?? 'TN',
    postalCode: overrides.postalCode ?? '600001',
    countryCode: overrides.countryCode ?? 'IN',
    isDefault: overrides.isDefault ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let component: CheckoutComponent;
  let cartService: CartService;
  let customerService: CustomerService;
  let orderService: OrderService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    customerService = TestBed.inject(CustomerService);
    orderService = TestBed.inject(OrderService);
    router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(cartService, 'refresh'); // no-op: avoid a real HTTP round trip in ngOnInit
  });

  function initWith(items: CartItem[], addresses: Address[] = [makeAddress()], selection: string[] | null = null): void {
    (cartService as any).cartSignal.set(makeCart(items));
    spyOn(cartService, 'checkoutSelection').and.returnValue(selection);
    spyOn(customerService, 'listAddresses').and.returnValue(of(addresses));
    fixture.detectChanges(); // ngOnInit
  }

  describe('stock-issue detection (same boundary rules as cart)', () => {
    it('quantity === quantityAvailable is not a stock issue', () => {
      const item = makeItem({ quantity: 2, quantityAvailable: 2 });
      expect(component.hasStockIssue(item)).toBeFalse();
    });

    it('quantity > quantityAvailable is a partial-shortage stock issue', () => {
      const item = makeItem({ quantity: 3, quantityAvailable: 2 });
      expect(component.hasStockIssue(item)).toBeTrue();
    });

    it('quantityAvailable <= 0 is fully out of stock', () => {
      const item = makeItem({ quantity: 1, quantityAvailable: 0 });
      expect(component.isOutOfStock(item)).toBeTrue();
    });
  });

  describe('checkoutItems / hasAnyStockIssue', () => {
    it('checks out the whole cart when no selection was made (direct /checkout link)', () => {
      const a = makeItem({ uuid: 'a' });
      const b = makeItem({ uuid: 'b' });
      initWith([a, b], [makeAddress()], null);
      expect(component.checkoutItems().map((i) => i.uuid)).toEqual(['a', 'b']);
    });

    it('checks out only the selected subset when CartService has a snapshot', () => {
      const a = makeItem({ uuid: 'a' });
      const b = makeItem({ uuid: 'b' });
      initWith([a, b], [makeAddress()], ['a']);
      expect(component.checkoutItems().map((i) => i.uuid)).toEqual(['a']);
    });

    it('hasAnyStockIssue is true if a selected item has insufficient stock', () => {
      const a = makeItem({ uuid: 'a', quantity: 5, quantityAvailable: 1 });
      initWith([a], [makeAddress()], ['a']);
      expect(component.hasAnyStockIssue()).toBeTrue();
    });

    it('hasAnyStockIssue is false when every checkout item is healthy', () => {
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      initWith([a], [makeAddress()], ['a']);
      expect(component.hasAnyStockIssue()).toBeFalse();
    });

    it('checkoutSubtotal sums only the checkout-item subset, not the whole cart', () => {
      const a = makeItem({ uuid: 'a', lineTotal: 1000 });
      const b = makeItem({ uuid: 'b', lineTotal: 5000 });
      initWith([a, b], [makeAddress()], ['a']);
      expect(component.checkoutSubtotal()).toBe(1000);
    });
  });

  describe('"Good to know" notes under Place order', () => {
    const notes = () => fixture.debugElement.queryAll(By.css('.checkout-notes__list li')).map((li) => li.nativeElement.textContent.trim());

    it('renders one bullet per entry in orderNotes, under a "Good to know" heading', () => {
      initWith([makeItem()]);
      expect(fixture.debugElement.query(By.css('.checkout-notes__title')).nativeElement.textContent.trim()).toBe('Good to know');
      expect(notes()).toEqual(component.orderNotes);
      expect(notes()[0]).toContain('record a video while opening the parcel');
    });

    it('adding a point to orderNotes shows it as another bullet', () => {
      (component as any).orderNotes = [...component.orderNotes, 'Delivery in 5–7 working days.'];
      initWith([makeItem()]);
      expect(notes().length).toBe(2);
      expect(notes()[1]).toBe('Delivery in 5–7 working days.');
    });

    it('hides the box entirely when there are no notes', () => {
      (component as any).orderNotes = [];
      initWith([makeItem()]);
      expect(fixture.debugElement.query(By.css('.checkout-notes'))).toBeNull();
    });
  });

  describe('checkoutSubtotal precision', () => {
    it('adds line totals in whole paise, without floating-point drift', () => {
      initWith([makeItem({ uuid: 'a', lineTotal: 798.68 }), makeItem({ uuid: 'b', lineTotal: 1856.92 })]);
      expect(component.checkoutSubtotal()).toBe(2655.6);
    });
  });

  describe('placeOrder — missing address branch and disabled-button interplay', () => {
    it('setting placeOrderError for a missing address IS reachable by calling placeOrder() directly (component-level guard exists)', () => {
      initWith([makeItem()], []); // no addresses at all -> selectedAddressUuid stays null
      expect(component.selectedAddressUuid).toBeNull();

      component.placeOrder();

      expect(component.placeOrderError()).toBe('Choose a delivery address first.');
      expect(component.placingOrder()).toBeFalse();
    });

    it('the "Place order" button is disabled whenever no address is selected, so a real click can never reach that branch through the UI', () => {
      initWith([makeItem()], []);
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('.checkout-summary button.btn--primary')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBeTrue();

      const placeOrderSpy = spyOn(component, 'placeOrder');
      button.click();
      expect(placeOrderSpy).not.toHaveBeenCalled();
    });

    it('once an address is selected, the button becomes enabled and a click invokes placeOrder()', () => {
      initWith([makeItem({ quantity: 1, quantityAvailable: 5 })], [makeAddress({ uuid: 'addr-1' })]);
      fixture.detectChanges();
      expect(component.selectedAddressUuid).toBe('addr-1'); // default-selected

      const button = fixture.debugElement.query(By.css('.checkout-summary button.btn--primary')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBeFalse();

      spyOn(orderService, 'checkout').and.returnValue(of({ uuid: 'order-1' } as OrderDetail));
      button.click();
      expect(orderService.checkout).toHaveBeenCalled();
    });

    it('the button stays disabled when a selected item has a stock issue, even with an address chosen', () => {
      const bad = makeItem({ uuid: 'a', quantity: 9, quantityAvailable: 1 });
      initWith([bad], [makeAddress()], ['a']);
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('.checkout-summary button.btn--primary')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
    });

    it('sends addressUuid, paymentMethod, markOrderAsGift and cartItemUuids when a selection is present', () => {
      const a = makeItem({ uuid: 'a' });
      initWith([a], [makeAddress({ uuid: 'addr-9' })], ['a']);
      component.paymentMethod = 'manual';
      component.markOrderAsGift = true;

      const checkoutSpy = spyOn(orderService, 'checkout').and.returnValue(of({ uuid: 'order-1' } as OrderDetail));
      const clearSelectionSpy = spyOn(cartService, 'clearCheckoutSelection');
      component.placeOrder();

      expect(checkoutSpy).toHaveBeenCalledWith({
        addressUuid: 'addr-9',
        paymentMethod: 'manual',
        markOrderAsGift: true,
        cartItemUuids: ['a'],
      });
      expect(clearSelectionSpy).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/orders', 'order-1']);
    });

    it('omits cartItemUuids entirely when checking out the whole cart (selectedUuids null)', () => {
      initWith([makeItem()], [makeAddress()], null);
      const checkoutSpy = spyOn(orderService, 'checkout').and.returnValue(of({ uuid: 'order-1' } as OrderDetail));
      component.placeOrder();

      const payload = checkoutSpy.calls.mostRecent().args[0];
      expect(payload.cartItemUuids).toBeUndefined();
    });

    it('surfaces the server error message and resets placingOrder on failure', () => {
      initWith([makeItem()], [makeAddress()]);
      spyOn(orderService, 'checkout').and.returnValue(throwError(() => ({ message: 'Insufficient stock' })));
      component.placeOrder();

      expect(component.placeOrderError()).toBe('Insufficient stock');
      expect(component.placingOrder()).toBeFalse();
    });
  });

  describe('online payment: not an order until Razorpay confirms it', () => {
    const razorpayOrder = { orderId: 'order_RZP1', amount: 100000, currency: 'INR', keyId: 'rzp_test' };
    let paymentService: PaymentService;
    let razorpayCheckout: RazorpayCheckoutService;

    beforeEach(() => {
      paymentService = TestBed.inject(PaymentService);
      razorpayCheckout = TestBed.inject(RazorpayCheckoutService);
    });

    async function placeOnlineOrder(): Promise<void> {
      initWith([makeItem()], [makeAddress()]);
      spyOn(orderService, 'checkout').and.returnValue(of({ uuid: 'order-1', orderStatus: 'awaiting_payment', razorpayOrder } as OrderDetail));
      component.placeOrder();
      await fixture.whenStable();
      await Promise.resolve();
    }

    it('closing the popup without paying stays on checkout, says the order was not placed, and keeps the cart', async () => {
      spyOn(razorpayCheckout, 'open').and.resolveTo({ outcome: 'dismissed' });
      const dismissSpy = spyOn(paymentService, 'dismissRazorpayPayment').and.returnValue(
        of({ uuid: 'order-1', orderStatus: 'payment_failed' } as OrderDetail),
      );
      const clearSelectionSpy = spyOn(cartService, 'clearCheckoutSelection');

      await placeOnlineOrder();

      expect(dismissSpy).toHaveBeenCalledWith('order-1');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(clearSelectionSpy).not.toHaveBeenCalled();
      expect(component.placeOrderError()).toContain('not placed');
      expect(component.processingPayment()).toBeFalse();
    });

    it('a payment still being confirmed goes to the order page', async () => {
      spyOn(razorpayCheckout, 'open').and.resolveTo({ outcome: 'dismissed' });
      spyOn(paymentService, 'dismissRazorpayPayment').and.returnValue(of({ uuid: 'order-1', orderStatus: 'payment_processing' } as OrderDetail));

      await placeOnlineOrder();

      expect(router.navigate).toHaveBeenCalledWith(['/orders', 'order-1']);
    });

    it('a failed verification is settled with the backend instead of assuming an order exists', async () => {
      spyOn(razorpayCheckout, 'open').and.resolveTo({
        outcome: 'success',
        payload: { razorpayOrderId: 'order_RZP1', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig' },
      });
      spyOn(paymentService, 'verifyRazorpayPayment').and.returnValue(throwError(() => ({ message: 'Payment verification failed' })));
      const dismissSpy = spyOn(paymentService, 'dismissRazorpayPayment').and.returnValue(
        of({ uuid: 'order-1', orderStatus: 'payment_failed' } as OrderDetail),
      );

      await placeOnlineOrder();

      expect(dismissSpy).toHaveBeenCalledWith('order-1');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('new address: label', () => {
    it('defaults to "Home"', () => {
      initWith([makeItem()]);
      component.startAddAddress();
      expect(component.addressForm.label).toBe('Home');
    });

    it('stays editable: a changed label is what gets sent', () => {
      initWith([makeItem()]);
      component.startAddAddress();
      component.addressForm = { ...component.addressForm, recipientName: 'Jane', line1: 'Street 1', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001', phone: '9999999999', label: 'Work' };
      const createSpy = spyOn(customerService, 'createAddress').and.returnValue(of({ id: 'new-addr' } as any));
      component.saveNewAddress();
      expect(createSpy.calls.mostRecent().args[0].label).toBe('Work');
    });

    it('keeps the saved label when editing an existing address', () => {
      const addr = makeAddress({ label: 'Mom' });
      initWith([makeItem()], [addr]);
      component.startEditAddress(addr);
      expect(component.addressForm.label).toBe('Mom');
    });
  });

  describe("new address: receiver's phone", () => {
    it("pre-fills the signed-in customer's mobile number", () => {
      (TestBed.inject(AuthService) as any).currentUserSignal.set({ mobileNumber: '7871487161' });
      initWith([makeItem()]);
      component.startAddAddress();
      expect(component.addressForm.phone).toBe('7871487161');
    });

    it('stays editable: a changed number is what gets sent', () => {
      (TestBed.inject(AuthService) as any).currentUserSignal.set({ mobileNumber: '7871487161' });
      initWith([makeItem()]);
      component.startAddAddress();
      component.addressForm.phone = '9000000001';
      expect(component.addressForm.phone).toBe('9000000001');
    });

    it('is empty when the customer has no mobile number on file', () => {
      initWith([makeItem()]);
      component.startAddAddress();
      expect(component.addressForm.phone).toBe('');
    });

    it(`labels the field "Receiver's phone number"`, () => {
      initWith([makeItem()]);
      component.startAddAddress();
      fixture.detectChanges();
      const labels = fixture.debugElement.queryAll(By.css('.auth__field span')).map((e) => e.nativeElement.textContent.trim());
      expect(labels).toContain("Receiver's phone number");
      expect(labels).not.toContain('Phone');
    });
  });

  describe('editing a saved address', () => {
    it('Edit fills the form with that address and marks it as editing', () => {
      const addr = makeAddress({ uuid: 'addr-1', recipientName: 'Suthana', phone: '7871487161', city: 'Tenkasi' });
      initWith([makeItem()], [addr]);
      component.startEditAddress(addr);
      expect(component.showAddressForm()).toBeTrue();
      expect(component.editingAddressUuid()).toBe('addr-1');
      expect(component.addressForm.recipientName).toBe('Suthana');
      expect(component.addressForm.city).toBe('Tenkasi');
    });

    it('saving calls updateAddress (not createAddress) and keeps that address selected', () => {
      const addr = makeAddress({ uuid: 'addr-1' });
      const other = makeAddress({ uuid: 'addr-2', isDefault: true });
      initWith([makeItem()], [addr, other]);
      const updateSpy = spyOn(customerService, 'updateAddress').and.returnValue(of({ status: 'ok' }));
      const createSpy = spyOn(customerService, 'createAddress');
      (customerService.listAddresses as jasmine.Spy).and.returnValue(of([addr, other]));

      component.startEditAddress(addr);
      component.addressForm.city = 'Madurai';
      component.saveNewAddress();

      expect(updateSpy).toHaveBeenCalledWith('addr-1', jasmine.objectContaining({ city: 'Madurai' }));
      expect(createSpy).not.toHaveBeenCalled();
      expect(component.selectedAddressUuid).toBe('addr-1');
      expect(component.showAddressForm()).toBeFalse();
      expect(component.editingAddressUuid()).toBeNull();
    });

    it('clicking Edit does not change which address is selected', () => {
      const a = makeAddress({ uuid: 'addr-1', isDefault: true });
      const b = makeAddress({ uuid: 'addr-2', isDefault: false });
      initWith([makeItem()], [a, b]);
      fixture.detectChanges();
      const editButtons = fixture.debugElement.queryAll(By.css('.address-option__edit'));
      editButtons[1].nativeElement.click();
      expect(component.selectedAddressUuid).toBe('addr-1');
      expect(component.editingAddressUuid()).toBe('addr-2');
    });

    it('cancel leaves edit mode', () => {
      const addr = makeAddress({ uuid: 'addr-1' });
      initWith([makeItem()], [addr]);
      component.startEditAddress(addr);
      component.cancelAddAddress();
      expect(component.editingAddressUuid()).toBeNull();
      expect(component.showAddressForm()).toBeFalse();
    });
  });

  describe('saveNewAddress validation', () => {
    const validForm = () => ({
      label: '',
      recipientName: 'Jane',
      phone: '9999999999',
      line1: 'Street 1',
      line2: '',
      city: 'Chennai',
      state: '',
      postalCode: '600001',
      countryCode: 'IN',
      isDefault: false,
    });

    it('rejects an incomplete form without calling the backend', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = { ...validForm(), recipientName: '' };
      component.saveNewAddress();

      expect(createSpy).not.toHaveBeenCalled();
      expect(component.addressFormError()).toBeTruthy();
      expect(component.addressFieldErrors().recipientName).toBeTruthy();
    });

    it('treats fields of only spaces as empty', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = { ...validForm(), line1: '   ', city: ' ' };
      component.saveNewAddress();

      expect(createSpy).not.toHaveBeenCalled();
      expect(component.addressFieldErrors().line1).toBeTruthy();
      expect(component.addressFieldErrors().city).toBeTruthy();
    });

    it('rejects a phone number that is not a 10-digit mobile number', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = { ...validForm(), phone: '999' };
      component.saveNewAddress();

      expect(createSpy).not.toHaveBeenCalled();
      expect(component.addressFieldErrors().phone).toContain('10-digit');
    });

    it('accepts a phone number written with +91 and spaces', () => {
      initWith([makeItem()], []);
      component.addressForm = { ...validForm(), phone: '+91 98765 43210' };
      const createSpy = spyOn(customerService, 'createAddress').and.returnValue(of({ id: 'new-addr' } as any));
      component.saveNewAddress();

      expect(createSpy).toHaveBeenCalled();
    });

    it('rejects a PIN code that is not 6 digits', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = { ...validForm(), postalCode: '6000a' };
      component.saveNewAddress();

      expect(createSpy).not.toHaveBeenCalled();
      expect(component.addressFieldErrors().postalCode).toContain('6-digit');
    });

    it('trims spaces before saving', () => {
      initWith([makeItem()], []);
      component.addressForm = { ...validForm(), recipientName: '  Jane  ' };
      const createSpy = spyOn(customerService, 'createAddress').and.returnValue(of({ id: 'new-addr' } as any));
      component.saveNewAddress();

      expect(createSpy.calls.mostRecent().args[0].recipientName).toBe('Jane');
    });

    it('saves and reloads addresses, preferring the newly-created one, on success', () => {
      initWith([makeItem()], []);
      component.addressForm = {
        label: '',
        recipientName: 'Jane',
        phone: '9999999999',
        line1: 'Street 1',
        line2: '',
        city: 'Chennai',
        state: '',
        postalCode: '600001',
        countryCode: 'IN',
        isDefault: false,
      };
      spyOn(customerService, 'createAddress').and.returnValue(of({ id: 'new-addr' } as any));
      const listSpy = customerService.listAddresses as jasmine.Spy;
      listSpy.and.returnValue(of([makeAddress({ uuid: 'new-addr' })]));

      component.saveNewAddress();

      expect(component.showAddressForm()).toBeFalse();
      expect(component.selectedAddressUuid).toBe('new-addr');
    });
  });

  describe('thumbnailSrc', () => {
    it('returns null once marked broken instead of the proxied URL', () => {
      initWith([makeItem({ uuid: 'x' })], []);
      const item = component.checkoutItems()[0];
      component.onThumbnailError(item);
      expect(component.thumbnailSrc(item)).toBeNull();
    });
  });

  describe('price display', () => {
    it('formatPrice keeps paise and omits them for whole rupees', () => {
      expect(component.formatPrice(2730.9)).toBe('₹2,730.90');
      expect(component.formatPrice(2731)).toBe('₹2,731');
    });

    it('shows the subtotal to the paisa, so it matches what Razorpay charges', () => {
      const a = makeItem({ uuid: 'a', lineTotal: 1908.46 });
      const b = makeItem({ uuid: 'b', lineTotal: 822.44 });
      initWith([a, b]);
      expect(component.formatPrice(component.checkoutSubtotal())).toBe('₹2,730.90');
    });
  });
});
