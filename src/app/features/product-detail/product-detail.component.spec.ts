import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductDetail, ProductVariant } from '../../core/models/product.models';

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    uuid: overrides.uuid ?? 'variant-1',
    variantName: overrides.variantName ?? 'Red / Free size',
    size: null,
    variantSkuPrefix: 'v',
    colorHex: '#f00',
    isActive: overrides.isActive ?? true,
    pricing: overrides.pricing ?? { sellerPrice: 4000, commissionPercent: 10, commissionPrice: 400, gstPercentForCommission: 18, gstPriceForCommission: 72, netAmount: 4472, gstPercentOnNetAmount: 0, gstPriceOnNetAmount: 0, checkoutPrice: 5000, discountPercent: 0, discountPrice: 0, sellingPrice: 5000 },
    inventory: overrides.inventory ?? { quantityAvailable: 5, quantityReserved: 0, quantitySold: 0, quantityDamaged: 0, quantityReturned: 0, lowStockThreshold: 2, isInStock: true },
    media: overrides.media ?? [],
  };
}

function makeDetail(variants: ProductVariant[]): ProductDetail {
  return {
    uuid: 'prod-1',
    seller: { uuid: 's1' },
    category: { uuid: 'c1', name: 'Sarees' },
    subCategory: null,
    productName: 'Kanchipuram Silk Saree',
    productDesc: 'A lovely handwoven saree.',
    sku: 'SKU-1',
    productType: 'SAREE',
    viewCount: 10,
    productApproval: 'approved',
    lifecycleStatus: 'active',
    isActive: true,
    attributes: { washCare: null, material: null, fabricPurity: null, color: null, zariType: null, zariColor: null, borderType: null, occasions: [], blouseIncluded: false, sareeLength: null, blouseLength: null, hasSale: false, saleEndDate: null },
    variants,
    media: [],
    createdAt: new Date().toISOString(),
  };
}

describe('ProductDetailComponent', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;
  let component: ProductDetailComponent;
  let productService: ProductService;
  let cartService: CartService;
  let authService: AuthService;
  let router: Router;

  function setup(productUuid: string | null = 'prod-1') {
    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(productUuid ? { productUuid } : {}) } },
        },
      ],
    });
    fixture = TestBed.createComponent(ProductDetailComponent);
    component = fixture.componentInstance;
    productService = TestBed.inject(ProductService);
    cartService = TestBed.inject(CartService);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  it('sets an error and stops loading when no productUuid is in the route', () => {
    setup(null);
    fixture.detectChanges();
    expect(component.error()).toBe('Product not found.');
    expect(component.loading()).toBeFalse();
  });

  it('loads the product and auto-selects the first variant', () => {
    setup('prod-1');
    const variant = makeVariant({ uuid: 'v1' });
    spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([variant])));
    fixture.detectChanges();

    expect(component.product()?.uuid).toBe('prod-1');
    expect(component.selectedVariant()?.uuid).toBe('v1');
    expect(component.loading()).toBeFalse();
  });

  describe('out-of-stock variant disables "Add to cart"', () => {
    it('renders the button disabled and shows "Out of stock" when the selected variant has none available', () => {
      setup('prod-1');
      const oos = makeVariant({
        uuid: 'v1',
        inventory: { quantityAvailable: 0, quantityReserved: 0, quantitySold: 0, quantityDamaged: 0, quantityReturned: 0, lowStockThreshold: 2, isInStock: false },
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([oos])));
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('.pd__actions button.btn--primary')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
      expect(button.textContent).toContain('Add to cart');

      const stockLabel = fixture.debugElement.query(By.css('.pd__stock')).nativeElement as HTMLElement;
      expect(stockLabel.textContent).toContain('Out of stock');
      expect(stockLabel.classList).toContain('pd__stock--out');
    });

    it('a disabled button click never reaches addToCart()/CartService', () => {
      setup('prod-1');
      const oos = makeVariant({
        uuid: 'v1',
        inventory: { quantityAvailable: 0, quantityReserved: 0, quantitySold: 0, quantityDamaged: 0, quantityReturned: 0, lowStockThreshold: 2, isInStock: false },
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([oos])));
      fixture.detectChanges();

      const addItemSpy = spyOn(cartService, 'addItem');
      const button = fixture.debugElement.query(By.css('.pd__actions button.btn--primary')).nativeElement as HTMLButtonElement;
      button.click();

      expect(addItemSpy).not.toHaveBeenCalled();
    });

    it('an in-stock variant leaves the button enabled', () => {
      setup('prod-1');
      const inStock = makeVariant({ uuid: 'v1' });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([inStock])));
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('.pd__actions button.btn--primary')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBeFalse();
    });
  });

  describe('selectVariant media resolution', () => {
    it('opens the gallery on the primary-flagged image, not just the first uploaded', () => {
      setup('prod-1');
      const variant = makeVariant({
        uuid: 'v1',
        media: [
          { uuid: 'm1', mediaType: 'image', url: 'https://s3/first.jpg', sortOrder: 0, isPrimary: false },
          { uuid: 'm2', mediaType: 'image', url: 'https://s3/primary.jpg', sortOrder: 1, isPrimary: true },
        ],
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([variant])));
      fixture.detectChanges();

      expect(component.selectedMediaUrl()).toBe(productService.mediaSrc('https://s3/primary.jpg'));
    });

    it('falls back to the first media item when nothing is flagged primary', () => {
      setup('prod-1');
      const variant = makeVariant({
        uuid: 'v1',
        media: [{ uuid: 'm1', mediaType: 'image', url: 'https://s3/first.jpg', sortOrder: 0, isPrimary: false }],
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([variant])));
      fixture.detectChanges();

      expect(component.selectedMediaUrl()).toBe(productService.mediaSrc('https://s3/first.jpg'));
    });

    it('is null when the variant has no media at all', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1', media: [] })])));
      fixture.detectChanges();
      expect(component.selectedMediaUrl()).toBeNull();
    });

    it('switching variants resets addedToCart/addToCartError state', () => {
      setup('prod-1');
      const v1 = makeVariant({ uuid: 'v1' });
      const v2 = makeVariant({ uuid: 'v2' });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([v1, v2])));
      fixture.detectChanges();
      (component as any).addedToCart.set(true);
      (component as any).addToCartError.set('stale error');

      component.selectVariant(v2);

      expect(component.addedToCart()).toBeFalse();
      expect(component.addToCartError()).toBeNull();
    });
  });

  describe('addToCart', () => {
    it('redirects to /login when unauthenticated instead of calling CartService', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      fixture.detectChanges();

      const addItemSpy = spyOn(cartService, 'addItem');
      component.addToCart();

      expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({}));
      expect(addItemSpy).not.toHaveBeenCalled();
    });

    it('adds the selected variant and flips addedToCart on success', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      fixture.detectChanges();
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });

      spyOn(cartService, 'addItem').and.returnValue(of({} as any));
      component.addToCart();

      expect(component.addedToCart()).toBeTrue();
      expect(component.addingToCart()).toBeFalse();
    });

    it('surfaces an error message and does not set addedToCart on failure', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      fixture.detectChanges();
      (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A' });

      spyOn(cartService, 'addItem').and.returnValue(throwError(() => ({ message: 'Out of stock' })));
      component.addToCart();

      expect(component.addToCartError()).toBe('Out of stock');
      expect(component.addedToCart()).toBeFalse();
    });

    it('is a no-op when there is no selected variant', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([])));
      fixture.detectChanges();
      const addItemSpy = spyOn(cartService, 'addItem');

      component.addToCart();

      expect(addItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('price formatting', () => {
    it('shows the strike-through original price only when discountPercent > 0', () => {
      setup('prod-1');
      const discounted = makeVariant({
        uuid: 'v1',
        pricing: { sellerPrice: 4000, commissionPercent: 10, commissionPrice: 400, gstPercentForCommission: 18, gstPriceForCommission: 72, netAmount: 4472, gstPercentOnNetAmount: 0, gstPriceOnNetAmount: 0, checkoutPrice: 6000, discountPercent: 20, discountPrice: 1200, sellingPrice: 4800 },
      });
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([discounted])));
      fixture.detectChanges();

      const strike = fixture.debugElement.query(By.css('.pd__price-strike'));
      const off = fixture.debugElement.query(By.css('.pd__price-off'));
      expect(strike).not.toBeNull();
      expect(off.nativeElement.textContent).toContain('20% off');
    });

    it('hides the strike-through price when there is no discount', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.pd__price-strike'))).toBeNull();
    });
  });
});
