import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProductCardComponent } from './product-card.component';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductDetail } from '../../core/models/product.models';
import { ProductSummary } from '../../core/models/product.models';

function makeSummary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    uuid: overrides.uuid ?? 'prod-1',
    productName: overrides.productName ?? 'Kanchipuram Silk Saree',
    sku: overrides.sku ?? 'SKU-1',
    productType: overrides.productType ?? 'SAREE',
    pricing: overrides.pricing ?? { from: 5000, to: 5000 },
    productApproval: overrides.productApproval ?? 'approved',
    lifecycleStatus: overrides.lifecycleStatus ?? 'active',
    thumbnail: overrides.thumbnail ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function makeVariant(overrides: any = {}) {
  return {
    uuid: overrides.uuid ?? 'variant-1',
    variantName: overrides.variantName ?? 'Red',
    size: null,
    variantSkuPrefix: 'v',
    colorHex: '#f00',
    isActive: overrides.isActive ?? true,
    pricing: null,
    inventory: overrides.inventory ?? { quantityAvailable: 5, quantityReserved: 0, quantitySold: 0, quantityDamaged: 0, quantityReturned: 0, lowStockThreshold: 2, isInStock: true },
    media: [],
  };
}

function makeDetail(variants: any[]): ProductDetail {
  return {
    uuid: 'prod-1',
    seller: { uuid: 's1' },
    category: { uuid: 'c1', name: 'Sarees' },
    subCategory: null,
    productName: 'Kanchipuram Silk Saree',
    productDesc: null,
    sku: 'SKU-1',
    productType: 'SAREE',
    viewCount: 0,
    productApproval: 'approved',
    lifecycleStatus: 'active',
    isActive: true,
    attributes: {} as any,
    variants,
    media: [],
    createdAt: new Date().toISOString(),
  };
}

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let component: ProductCardComponent;
  let productService: ProductService;
  let cartService: CartService;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    component.product = makeSummary();
    productService = TestBed.inject(ProductService);
    cartService = TestBed.inject(CartService);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('priceLabel', () => {
    it('shows a single price when from === to', () => {
      component.product = makeSummary({ pricing: { from: 4999, to: 4999 } });
      expect(component.priceLabel).toBe('₹4,999');
    });

    it('shows a "from – to" range when they differ', () => {
      component.product = makeSummary({ pricing: { from: 2000, to: 8000 } });
      expect(component.priceLabel).toBe('₹2,000 – ₹8,000');
    });

    it('is null when pricing.from is null (no active variant with pricing)', () => {
      component.product = makeSummary({ pricing: { from: null, to: null } });
      expect(component.priceLabel).toBeNull();
    });

    it('rounds fractional prices before formatting', () => {
      component.product = makeSummary({ pricing: { from: 1999.6, to: 1999.6 } });
      expect(component.priceLabel).toBe('₹2,000');
    });
  });

  describe('thumbnailSrc', () => {
    it('routes through ProductService.mediaSrc, not the raw URL', () => {
      component.product = makeSummary({ thumbnail: { url: 'https://s3/raw.jpg', mediaType: 'image' } });
      expect(component.thumbnailSrc).toBe(productService.mediaSrc('https://s3/raw.jpg'));
    });

    it('falls back to null after onThumbnailError, even if the URL was valid-looking', () => {
      component.product = makeSummary({ thumbnail: { url: 'https://s3/raw.jpg', mediaType: 'image' } });
      component.onThumbnailError();
      expect(component.thumbnailSrc).toBeNull();
    });
  });

  describe('toggleWishlist', () => {
    it('redirects to /login with redirectTo when not authenticated, and does not call the wishlist API', () => {
      const toggleSpy = spyOn(cartService, 'addItem'); // sanity: unrelated
      const wishlistToggleSpy = spyOn(TestBed.inject(WishlistService), 'toggle');
      const event = new Event('click');
      spyOn(event, 'preventDefault');
      spyOn(event, 'stopPropagation');

      component.toggleWishlist(event);

      expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({ queryParams: jasmine.any(Object) }));
      expect(wishlistToggleSpy).not.toHaveBeenCalled();
      expect(toggleSpy).not.toHaveBeenCalled();
    });

    it('calls WishlistService.toggle when authenticated', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      const wishlistService = TestBed.inject(WishlistService);
      const toggleSpy = spyOn(wishlistService, 'toggle').and.returnValue(of([]));
      const event = new Event('click');

      component.toggleWishlist(event);

      expect(toggleSpy).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('addToCart', () => {
    it('redirects to /login when not authenticated, without calling getProductDetail', () => {
      const detailSpy = spyOn(productService, 'getProductDetail');
      const event = new Event('click');
      component.addToCart(event);
      expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({}));
      expect(detailSpy).not.toHaveBeenCalled();
    });

    it('a single active, in-stock variant is added to the cart directly', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      const addSpy = spyOn(cartService, 'addItem').and.returnValue(of({} as any));

      component.addToCart(new Event('click'));

      expect(addSpy).toHaveBeenCalledWith({ variantUuid: 'v1' });
      expect(component.addingToCart()).toBeFalse();
      expect(component.addToCartError()).toBeNull();
    });

    it('a single active, out-of-stock variant is refused with a clear error and never reaches CartService', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      const outOfStockVariant = makeVariant({
        uuid: 'v1',
        inventory: { quantityAvailable: 0, quantityReserved: 0, quantitySold: 0, quantityDamaged: 0, quantityReturned: 0, lowStockThreshold: 2, isInStock: false },
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([outOfStockVariant])));
      const addSpy = spyOn(cartService, 'addItem');

      component.addToCart(new Event('click'));

      expect(addSpy).not.toHaveBeenCalled();
      expect(component.addToCartError()).toBe('Out of stock.');
      expect(component.addingToCart()).toBeFalse();
    });

    it('filters out inactive variants before counting — a single active variant among several inactive ones still quick-adds', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      const active = makeVariant({ uuid: 'v-active', isActive: true });
      const inactive = makeVariant({ uuid: 'v-inactive', isActive: false });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([active, inactive])));
      const addSpy = spyOn(cartService, 'addItem').and.returnValue(of({} as any));

      component.addToCart(new Event('click'));

      expect(addSpy).toHaveBeenCalledWith({ variantUuid: 'v-active' });
    });

    it('more than one active variant navigates to the product detail page instead of guessing', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(
        of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2' })])),
      );
      const addSpy = spyOn(cartService, 'addItem');

      component.addToCart(new Event('click'));

      expect(addSpy).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/product', 'prod-1']);
      expect(component.addingToCart()).toBeFalse();
    });

    it('surfaces an error message when getProductDetail fails', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(throwError(() => ({ message: 'Product unavailable' })));

      component.addToCart(new Event('click'));

      expect(component.addToCartError()).toBe('Product unavailable');
      expect(component.addingToCart()).toBeFalse();
    });

    it('surfaces an error message when addItem fails after a valid single-variant resolve', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      spyOn(cartService, 'addItem').and.returnValue(throwError(() => ({ message: 'Insufficient stock' })));

      component.addToCart(new Event('click'));

      expect(component.addToCartError()).toBe('Insufficient stock');
      expect(component.addingToCart()).toBeFalse();
    });
  });
});
