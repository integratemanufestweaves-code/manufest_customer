import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CartComponent } from './cart.component';
import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { CartItem, CartView } from '../../core/models/cart.models';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  // Plain spread (not `??` per field) so an explicit `null` override (e.g.
  // `lineTotal: null`) is preserved instead of being treated as "not
  // provided" and silently replaced by the default.
  return {
    uuid: 'item-1',
    quantity: 2,
    priceAtAdd: 1000,
    currentPrice: 1000,
    lineTotal: 2000,
    quantityAvailable: 5,
    variant: { uuid: 'variant-1', variantName: 'Red / M', colorHex: '#ff0000', thumbnail: null },
    product: { uuid: 'product-1', productName: 'Kanchipuram Silk Saree' },
    ...overrides,
  };
}

function makeCart(items: CartItem[]): CartView {
  return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), total: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) };
}

describe('CartComponent', () => {
  let fixture: ComponentFixture<CartComponent>;
  let component: CartComponent;
  let cartService: CartService;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    // ngOnInit triggers CartService.refresh(), which issues a GET; flush or
    // verify leniently so unrelated tests don't fail on an unflushed request.
    const pending = httpMock.match(() => true);
    pending.forEach((req) => req.flush({ success: true, data: makeCart([]) }));
    httpMock.verify();
  });

  function setCart(items: CartItem[]): void {
    (cartService as any).cartSignal.set(makeCart(items));
  }

  describe('hasStockIssue / isOutOfStock (boundary conditions)', () => {
    it('quantity exactly equal to quantityAvailable is NOT a stock issue', () => {
      const item = makeItem({ quantity: 3, quantityAvailable: 3 });
      expect(component.hasStockIssue(item)).toBeFalse();
    });

    it('quantity one more than quantityAvailable IS a stock issue (partial shortage)', () => {
      const item = makeItem({ quantity: 4, quantityAvailable: 3 });
      expect(component.hasStockIssue(item)).toBeTrue();
    });

    it('quantityAvailable of exactly 0 is out of stock', () => {
      const item = makeItem({ quantity: 1, quantityAvailable: 0 });
      expect(component.isOutOfStock(item)).toBeTrue();
      expect(component.hasStockIssue(item)).toBeTrue();
    });

    it('negative quantityAvailable (defensive) is still treated as out of stock', () => {
      const item = makeItem({ quantity: 1, quantityAvailable: -1 });
      expect(component.isOutOfStock(item)).toBeTrue();
    });

    it('a healthy item (quantity well under available) has neither flag', () => {
      const item = makeItem({ quantity: 1, quantityAvailable: 10 });
      expect(component.hasStockIssue(item)).toBeFalse();
      expect(component.isOutOfStock(item)).toBeFalse();
    });
  });

  describe('selectedItems / selectedSubtotal / selectedCount', () => {
    it('excludes a fully-out-of-stock item from selection and subtotal by default', () => {
      fixture.detectChanges();
      const healthy = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5, lineTotal: 1000 });
      const outOfStock = makeItem({ uuid: 'b', quantity: 1, quantityAvailable: 0, lineTotal: 500 });
      setCart([healthy, outOfStock]);

      expect(component.selectedItems().map((i) => i.uuid)).toEqual(['a']);
      expect(component.selectedCount()).toBe(1);
      expect(component.selectedSubtotal()).toBe(1000);
      expect(component.stockIssueCount()).toBe(1);
    });

    it('excludes a partial-shortage item (quantity > quantityAvailable) from selection', () => {
      fixture.detectChanges();
      const shortage = makeItem({ uuid: 'c', quantity: 5, quantityAvailable: 2, lineTotal: 5000 });
      setCart([shortage]);

      expect(component.selectedItems()).toEqual([]);
      expect(component.selectedSubtotal()).toBe(0);
      expect(component.stockIssueCount()).toBe(1);
    });

    it('an item explicitly deselected by the customer is excluded even though stock is fine', () => {
      fixture.detectChanges();
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const b = makeItem({ uuid: 'b', quantity: 1, quantityAvailable: 5 });
      setCart([a, b]);

      component.toggleItem(a);
      expect(component.selectedItems().map((i) => i.uuid)).toEqual(['b']);
    });

    it('still excludes a selected item whose stock drops to 0 after a background refresh (belt-and-suspenders filter)', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 2, quantityAvailable: 5 });
      setCart([item]);
      expect(component.selectedItems().length).toBe(1);

      // Simulate stock dropping to 0 without the customer having deselected it.
      setCart([{ ...item, quantityAvailable: 0 }]);
      expect(component.selectedItems().length).toBe(0);
    });

    it('null/zero lineTotal items do not throw and contribute 0 to the subtotal', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5, lineTotal: null as any });
      setCart([item]);
      expect(component.selectedSubtotal()).toBe(0);
    });
  });

  describe('isSelected / toggleItem', () => {
    it('a stock-issue item is never reported as selected, even before any toggle', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 5, quantityAvailable: 1 });
      expect(component.isSelected(item)).toBeFalse();
    });

    it('toggleItem is a no-op for a stock-issue item (cannot be force-selected)', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 5, quantityAvailable: 1 });
      setCart([item]);
      component.toggleItem(item);
      expect(component.isSelected(item)).toBeFalse();
      expect(component.selectedItems().length).toBe(0);
    });

    it('toggleItem toggles a healthy item on and off', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      setCart([item]);
      expect(component.isSelected(item)).toBeTrue();
      component.toggleItem(item);
      expect(component.isSelected(item)).toBeFalse();
      component.toggleItem(item);
      expect(component.isSelected(item)).toBeTrue();
    });
  });

  describe('allSelected / toggleAll', () => {
    it('is true when every non-stock-issue item is selected, ignoring stock-issue items', () => {
      fixture.detectChanges();
      const healthy = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const broken = makeItem({ uuid: 'b', quantity: 5, quantityAvailable: 1 });
      setCart([healthy, broken]);
      expect(component.allSelected()).toBeTrue();
    });

    it('is false once a healthy item is deselected', () => {
      fixture.detectChanges();
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const b = makeItem({ uuid: 'b', quantity: 1, quantityAvailable: 5 });
      setCart([a, b]);
      component.toggleItem(a);
      expect(component.allSelected()).toBeFalse();
    });

    it('is false for an empty cart', () => {
      fixture.detectChanges();
      setCart([]);
      expect(component.allSelected()).toBeFalse();
    });

    it('toggleAll selects everything selectable when not all selected', () => {
      fixture.detectChanges();
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const b = makeItem({ uuid: 'b', quantity: 1, quantityAvailable: 5 });
      setCart([a, b]);
      component.toggleItem(a); // deselect a
      expect(component.allSelected()).toBeFalse();

      component.toggleAll();
      expect(component.isSelected(a)).toBeTrue();
      expect(component.isSelected(b)).toBeTrue();
      expect(component.allSelected()).toBeTrue();
    });

    it('toggleAll deselects everything when all are currently selected', () => {
      fixture.detectChanges();
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const b = makeItem({ uuid: 'b', quantity: 1, quantityAvailable: 5 });
      setCart([a, b]);
      expect(component.allSelected()).toBeTrue();

      component.toggleAll();
      expect(component.isSelected(a)).toBeFalse();
      expect(component.isSelected(b)).toBeFalse();
    });
  });

  describe('goToCheckout', () => {
    it('does nothing when nothing is selected', () => {
      fixture.detectChanges();
      setCart([]);
      component.goToCheckout();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('hands only the selected (non-stock-issue) uuids to CartService and navigates to /checkout', () => {
      fixture.detectChanges();
      const a = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 5 });
      const brokenItem = makeItem({ uuid: 'b', quantity: 9, quantityAvailable: 1 });
      setCart([a, brokenItem]);

      const setSelectionSpy = spyOn(cartService, 'setCheckoutSelection').and.callThrough();
      component.goToCheckout();

      expect(setSelectionSpy).toHaveBeenCalledWith(['a']);
      expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
    });
  });

  describe('quantity/remove/clear mutation error handling', () => {
    it('updateQuantity refuses to go above quantityAvailable', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 2, quantityAvailable: 3 });
      const updateSpy = spyOn(cartService, 'updateItemQuantity');
      component.updateQuantity(item, 4);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('updateQuantity refuses to go below 1', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 3 });
      const updateSpy = spyOn(cartService, 'updateItemQuantity');
      component.updateQuantity(item, 0);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('surfaces the error message and clears pendingItem when updateItemQuantity fails', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a', quantity: 1, quantityAvailable: 3 });
      spyOn(cartService, 'updateItemQuantity').and.returnValue(throwError(() => ({ message: 'Out of stock now' })));
      component.updateQuantity(item, 2);
      expect(component.error()).toBe('Out of stock now');
      expect(component.pendingItem()).toBeNull();
    });

    it('removeItem clears the error and pendingItem on success', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'a' });
      spyOn(cartService, 'removeItem').and.returnValue(of(makeCart([])));
      component.removeItem(item);
      expect(component.pendingItem()).toBeNull();
      expect(component.error()).toBeNull();
    });

    it('clearCart surfaces an error message on failure', () => {
      fixture.detectChanges();
      spyOn(cartService, 'clear').and.returnValue(throwError(() => ({ message: 'Could not clear' })));
      component.clearCart();
      expect(component.error()).toBe('Could not clear');
    });
  });

  describe('thumbnailSrc', () => {
    it('delegates to ProductService.mediaSrc for the variant thumbnail', () => {
      fixture.detectChanges();
      const productService = TestBed.inject(ProductService);
      const item = makeItem({ variant: { uuid: 'v1', variantName: null, colorHex: null, thumbnail: { url: 'https://s3/raw.jpg', mediaType: 'image' } } });
      const src = component.thumbnailSrc(item);
      expect(src).toBe(productService.mediaSrc('https://s3/raw.jpg'));
      expect(src).toContain('/public/products/media?url=');
    });

    it('falls back to null once the thumbnail is marked broken', () => {
      fixture.detectChanges();
      const item = makeItem({ uuid: 'x' });
      component.onThumbnailError(item);
      expect(component.thumbnailSrc(item)).toBeNull();
    });
  });

  describe('priceChanged', () => {
    it('is true when currentPrice differs from priceAtAdd', () => {
      const item = makeItem({ currentPrice: 1200, priceAtAdd: 1000 });
      expect(component.priceChanged(item)).toBeTrue();
    });

    it('is false when currentPrice is null (unavailable) rather than reporting a bogus change', () => {
      const item = makeItem({ currentPrice: null, priceAtAdd: 1000 });
      expect(component.priceChanged(item)).toBeFalse();
    });

    it('is false when prices match', () => {
      const item = makeItem({ currentPrice: 1000, priceAtAdd: 1000 });
      expect(component.priceChanged(item)).toBeFalse();
    });
  });
});
