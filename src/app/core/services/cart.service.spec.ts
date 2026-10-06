import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CartService } from './cart.service';
import { CartItem, CartView } from '../models/cart.models';

function makeItem(uuid: string, quantity: number, price: number, productUuid = `product-${uuid}`): CartItem {
  return {
    uuid,
    quantity,
    priceAtAdd: price,
    currentPrice: price,
    lineTotal: price * quantity,
    quantityAvailable: 10,
    variant: { uuid: `variant-${uuid}`, variantName: null, colorHex: null, thumbnail: null },
    product: { uuid: productUuid, productName: uuid },
  };
}

function makeCart(items: CartItem[]): CartView {
  return { items, itemCount: items.length, total: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) };
}

describe('CartService', () => {
  let service: CartService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CartService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('out-of-order quantity responses', () => {
    it('ignores a slow response for an earlier tap that arrives after a later one', () => {
      service.updateItemQuantity('a', 2).subscribe();
      service.updateItemQuantity('b', 3).subscribe();
      const [first, second] = httpMock.match((req) => req.method === 'PUT');

      // Second (newer) response lands first, then the stale first one.
      second.flush({ success: true, data: makeCart([makeItem('a', 2, 100), makeItem('b', 3, 50)]) });
      first.flush({ success: true, data: makeCart([makeItem('a', 2, 100), makeItem('b', 2, 50)]) });

      expect(service.cart().items.find((i) => i.uuid === 'b')?.quantity).toBe(3);
    });

    it('applies responses that arrive in order', () => {
      service.updateItemQuantity('a', 2).subscribe();
      service.updateItemQuantity('a', 3).subscribe();
      const [first, second] = httpMock.match((req) => req.method === 'PUT');

      first.flush({ success: true, data: makeCart([makeItem('a', 2, 100)]) });
      expect(service.cart().items[0].quantity).toBe(2);
      second.flush({ success: true, data: makeCart([makeItem('a', 3, 100)]) });
      expect(service.cart().items[0].quantity).toBe(3);
    });
  });

  describe('isVariantInCart / isProductInCart', () => {
    it('reflects what the latest cart contains', () => {
      expect(service.isProductInCart('product-x')).toBeFalse();

      service.addItem({ variantUuid: 'variant-x' }).subscribe();
      httpMock.expectOne((req) => req.method === 'POST').flush({ success: true, data: makeCart([makeItem('x', 1, 100)]) });

      expect(service.isVariantInCart('variant-x')).toBeTrue();
      expect(service.isProductInCart('product-x')).toBeTrue();
      expect(service.isVariantInCart('variant-y')).toBeFalse();
    });
  });
});
