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

  describe('saveNewAddress validation', () => {
    it('rejects an incomplete form without calling the backend', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = { ...component.addressForm, recipientName: '' };
      component.saveNewAddress();

      expect(createSpy).not.toHaveBeenCalled();
      expect(component.addressFormError()).toContain('Fill in');
    });

    it('rejects a country code that is not exactly 2 characters', () => {
      initWith([makeItem()], []);
      const createSpy = spyOn(customerService, 'createAddress');
      component.addressForm = {
        label: '',
        recipientName: 'Jane',
        phone: '999',
        line1: 'Street 1',
        line2: '',
        city: 'Chennai',
        state: '',
        postalCode: '600001',
        countryCode: 'IND',
        isDefault: false,
      };
      component.saveNewAddress();
      expect(createSpy).not.toHaveBeenCalled();
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
});
