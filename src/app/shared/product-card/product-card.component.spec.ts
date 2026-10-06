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
    colorHex: overrides.colorHex === undefined ? '#f00' : overrides.colorHex,
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

    it('shows only the lowest variant price, not a range, when variant prices differ', () => {
      component.product = makeSummary({ pricing: { from: 57.98, to: 64.47 } });
      expect(component.priceLabel).toBe('₹57.98');
    });

    it('is null when pricing.from is null (no active variant with pricing)', () => {
      component.product = makeSummary({ pricing: { from: null, to: null } });
      expect(component.priceLabel).toBeNull();
    });

    it('shows paise when a price has any (never rounds them away)', () => {
      component.product = makeSummary({ pricing: { from: 1999.6, to: 1999.6 } });
      expect(component.priceLabel).toBe('₹1,999.60');
    });

    it('omits paise for whole-rupee prices', () => {
      component.product = makeSummary({ pricing: { from: 2000, to: 2000 } });
      expect(component.priceLabel).toBe('₹2,000');
    });
  });

  describe('out of stock up front', () => {
    it('shows the badge, greys the card and disables the button when inStock is false', () => {
      component.product = { ...makeSummary(), inStock: false };
      const detailSpy = spyOn(productService, 'getProductDetail');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card__stock-badge').textContent.trim()).toBe('Out of stock');
      const btn = fixture.nativeElement.querySelector('.card__add--out') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
      expect(btn.textContent?.trim()).toBe('Currently unavailable');
      expect(fixture.nativeElement.querySelector('.card').classList).toContain('card--out');
      component.addToCart(new Event('click'));
      expect(detailSpy).not.toHaveBeenCalled();
    });

    it('still shows "Go to cart" for an out-of-stock product that is already in the cart', () => {
      component.product = { ...makeSummary(), inStock: false };
      spyOn(cartService, 'isProductInCart').and.returnValue(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card__add--in-cart')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.card__add--out')).toBeNull();
    });

    it('keeps "+ Add to cart" when the flag is missing (older backend) or true', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.card__stock-badge')).toBeNull();
      expect(fixture.nativeElement.querySelector('.card__add').textContent.trim()).toBe('+ Add to cart');
    });
  });

  describe('"Go to cart" once the product is in the cart', () => {
    it('swaps "+ Add to cart" for "Go to cart", which opens /cart', () => {
      spyOn(cartService, 'isProductInCart').and.returnValue(true);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('.card__add--in-cart');
      expect(btn.textContent.trim()).toBe('Go to cart');
      btn.click();
      expect(router.navigate).toHaveBeenCalledWith(['/cart']);
    });

    it('shows "+ Add to cart" when the product is not in the cart', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.card__add--in-cart')).toBeNull();
      expect(fixture.nativeElement.querySelector('.card__add').textContent.trim()).toBe('+ Add to cart');
    });
  });

  describe('sellerLabel', () => {
    it("shows the seller's brand name", () => {
      component.product = { ...makeSummary(), seller: { uuid: 's1', name: 'Ravi Kumar', brandName: 'Kukkumam' } };
      fixture.detectChanges();
      expect(component.sellerLabel).toBe('Kukkumam');
      expect(fixture.nativeElement.querySelector('.card__seller').textContent.trim()).toBe('Kukkumam');
    });

    it("falls back to the seller's name when there is no brand", () => {
      component.product = { ...makeSummary(), seller: { uuid: 's1', name: 'Ravi Kumar', brandName: null } };
      expect(component.sellerLabel).toBe('Ravi Kumar');
    });

    it('falls back to "Manufest Weaves" when no seller info came back', () => {
      component.product = makeSummary();
      fixture.detectChanges();
      expect(component.sellerLabel).toBe('Manufest Weaves');
      expect(fixture.nativeElement.querySelector('.card__seller').textContent.trim()).toBe('Manufest Weaves');
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

    it('more than one active variant shows colour swatches instead of guessing or navigating', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(
        of(makeDetail([makeVariant({ uuid: 'v1', colorHex: '#f00' }), makeVariant({ uuid: 'v2', colorHex: '#0a0' }), makeVariant({ uuid: 'v3', isActive: false })])),
      );
      const addSpy = spyOn(cartService, 'addItem');

      component.addToCart(new Event('click'));
      fixture.detectChanges();

      expect(addSpy).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.addingToCart()).toBeFalse();
      expect(component.variantChoices()?.map((v) => v.uuid)).toEqual(['v1', 'v2']);
      const swatches = fixture.nativeElement.querySelectorAll('.card__swatch');
      expect(swatches.length).toBe(2);
      expect(fixture.nativeElement.querySelector('.card__add')).toBeNull();
    });

    it('a variant without a colour shows a name chip', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(
        of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2', colorHex: null, variantName: 'Plain' })])),
      );

      component.addToCart(new Event('click'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card__swatch-chip').textContent.trim()).toBe('Plain');
    });

    it('clicking a swatch opens the detail page on that variant', () => {
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });
      spyOn(productService, 'getProductDetail').and.returnValue(
        of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2', colorHex: '#0a0' })])),
      );
      component.addToCart(new Event('click'));
      fixture.detectChanges();

      fixture.nativeElement.querySelectorAll('.card__swatch')[1].click();

      expect(router.navigate).toHaveBeenCalledWith(['/product', 'prod-1'], { queryParams: { variant: 'v2' } });
    });

    it('closing the swatches brings the Add to cart button back', () => {
      component.variantChoices.set([makeVariant({ uuid: 'v1' }) as any, makeVariant({ uuid: 'v2' }) as any]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.card__variants-close').click();
      fixture.detectChanges();

      expect(component.variantChoices()).toBeNull();
      expect(fixture.nativeElement.querySelector('.card__add')).not.toBeNull();
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
