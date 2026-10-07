import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { of, throwError } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductDetail, ProductVariant } from '../../core/models/product.models';
import { ReviewService } from '../../core/services/review.service';
import { ProductReview } from '../../core/models/review.models';

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
    attributes: { washCare: null, material: null, fabricPurity: null, color: null, zariType: null, zariColor: null, borderType: null, occasions: [], fabrics: [], weaves: [], blouseIncluded: false, sareeLength: null, blouseLength: null, hasSale: false, saleEndDate: null },
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
  let paramMap$: BehaviorSubject<ParamMap>;

  function setup(productUuid: string | null = 'prod-1', queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: (paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap(productUuid ? { productUuid } : {}))),
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
          },
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

  it('opens on the variant named in ?variant= (a product-card colour swatch)', () => {
    setup('prod-1', { variant: 'v2' });
    spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2' })])));
    fixture.detectChanges();

    expect(component.selectedVariant()?.uuid).toBe('v2');
  });

  it('falls back to the first variant when ?variant= is unknown', () => {
    setup('prod-1', { variant: 'nope' });
    spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2' })])));
    fixture.detectChanges();

    expect(component.selectedVariant()?.uuid).toBe('v1');
  });

  it('loads the new product when the route moves to another one on the same page (e.g. a "You may also like" card)', () => {
    setup('prod-1');
    const detailSpy = spyOn(productService, 'getProductDetail').and.callFake((uuid: string) =>
      of({ ...makeDetail([makeVariant({ uuid: `${uuid}-v1` })]), uuid }),
    );
    const relatedSpy = spyOn(productService, 'getRelatedProducts').and.returnValue(of([]));
    fixture.detectChanges();
    expect(component.product()?.uuid).toBe('prod-1');

    paramMap$.next(convertToParamMap({ productUuid: 'prod-2' }));

    expect(detailSpy).toHaveBeenCalledWith('prod-2');
    expect(relatedSpy).toHaveBeenCalledWith('prod-2');
    expect(component.product()?.uuid).toBe('prod-2');
    expect(component.selectedVariant()?.uuid).toBe('prod-2-v1');
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

  describe('product details list', () => {
    const rows = () =>
      fixture.debugElement
        .queryAll(By.css('.pd__attrs > div'))
        .map((d) => d.queryAll(By.css('span')).map((sp) => sp.nativeElement.textContent.trim()).join(' '));

    it('shows every filled-in attribute, joining multi-value ones', () => {
      setup('prod-1');
      const detail = makeDetail([makeVariant({ uuid: 'v1' })]);
      detail.attributes = {
        ...detail.attributes,
        color: { uuid: 'c', name: 'Teal' },
        zariColor: { uuid: 'z', name: 'Gold' },
        occasions: [{ uuid: 'o1', name: 'Wedding' }, { uuid: 'o2', name: 'Festive' }],
        fabrics: [{ uuid: 'f1', name: 'Silk' }],
        weaves: [{ uuid: 'w1', name: 'Kanjivaram' }],
        blouseIncluded: true,
        sareeLength: '6',
        blouseLength: '0.8 metres',
      };
      spyOn(productService, 'getProductDetail').and.returnValue(of(detail));
      fixture.detectChanges();

      expect(rows()).toEqual(jasmine.arrayContaining([
        'Colour Teal',
        'Fabric Silk',
        'Weave Kanjivaram',
        'Zari colour Gold',
        'Saree length 6 m',
        'Blouse Included',
        'Blouse length 0.8 metres',
        'Occasion Wedding, Festive',
      ]));
    });

    it('says "Not included" for a saree without a blouse', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' })])));
      fixture.detectChanges();

      expect(rows()).toContain('Blouse Not included');
    });

    it('shows the selected colour name next to the swatches', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(
        of(makeDetail([makeVariant({ uuid: 'v1', variantName: 'Teal' }), makeVariant({ uuid: 'v2', variantName: 'Maroon' })])),
      );
      fixture.detectChanges();
      component.selectVariant(component.product()!.variants[1]);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.pd__variants-name')).nativeElement.textContent.trim()).toBe('Maroon');
    });

    it('adds the sub-category to the breadcrumb', () => {
      setup('prod-1');
      const detail = { ...makeDetail([makeVariant({ uuid: 'v1' })]), subCategory: { uuid: 'sc', name: 'Silk Sarees' } };
      spyOn(productService, 'getProductDetail').and.returnValue(of(detail));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.pd__crumbs')).nativeElement.textContent).toContain('Silk Sarees');
    });
  });

  describe('"Go to cart" once the colour is in the cart', () => {
    it('shows "Go to cart" for a variant already in the cart, and it opens /cart', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2' })])));
      spyOn(cartService, 'isVariantInCart').and.callFake((uuid: string) => uuid === 'v1');
      fixture.detectChanges();

      const goBtn = fixture.debugElement.query(By.css('.btn--go-cart'));
      expect(goBtn.nativeElement.textContent.trim()).toBe('Go to cart');
      goBtn.nativeElement.click();
      expect(router.navigate).toHaveBeenCalledWith(['/cart']);
    });

    it('shows "Add to cart" again after switching to a colour not in the cart', () => {
      setup('prod-1');
      spyOn(productService, 'getProductDetail').and.returnValue(of(makeDetail([makeVariant({ uuid: 'v1' }), makeVariant({ uuid: 'v2' })])));
      spyOn(cartService, 'isVariantInCart').and.callFake((uuid: string) => uuid === 'v1');
      fixture.detectChanges();

      component.selectVariant(component.product()!.variants[1]);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.btn--go-cart'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.pd__actions .btn--primary')).nativeElement.textContent.trim()).toBe('Add to cart');
    });
  });

  describe('lengthLabel', () => {
    it('adds metres to a bare number and keeps text that already has a unit', () => {
      setup('prod-1');
      expect(component.lengthLabel('6')).toBe('6 m');
      expect(component.lengthLabel(' 5.5 ')).toBe('5.5 m');
      expect(component.lengthLabel('0.8 metres')).toBe('0.8 metres');
      expect(component.lengthLabel('6 yards')).toBe('6 yards');
    });
  });

  describe('customer reviews', () => {
    const reviewItem = (uuid: string, rating = 5): ProductReview => ({ uuid, rating, review: `Review ${uuid}`, images: [], status: 'active', createdAt: '2026-10-07T10:00:00Z' });
    let reviewService: ReviewService;

    function load(detail: ProductDetail = makeDetail([makeVariant()])) {
      reviewService = TestBed.inject(ReviewService);
      spyOn(productService, 'getProductDetail').and.returnValue(of(detail));
      spyOn(productService, 'getRelatedProducts').and.returnValue(of([]));
    }

    it('loads the first page of active reviews with the product and knows there are more', () => {
      setup('prod-1');
      load();
      const listSpy = spyOn(reviewService, 'listForProduct').and.returnValue(
        of({ items: [reviewItem('r1'), reviewItem('r2')], meta: { page: 1, limit: 10, totalCount: 3, totalPages: 1 } as never }),
      );
      fixture.detectChanges();

      expect(listSpy).toHaveBeenCalledWith('prod-1', 1);
      expect(component.reviews().map((r) => r.uuid)).toEqual(['r1', 'r2']);
      expect(component.reviewTotal()).toBe(3);
      expect(component.hasMoreReviews()).toBeTrue();
      expect(fixture.nativeElement.querySelectorAll('.pd-review').length).toBe(2);
    });

    it('"Show more" appends the next page', () => {
      setup('prod-1');
      load();
      const listSpy = spyOn(reviewService, 'listForProduct').and.returnValues(
        of({ items: [reviewItem('r1')], meta: { totalCount: 2 } as never }),
        of({ items: [reviewItem('r2')], meta: { totalCount: 2 } as never }),
      );
      fixture.detectChanges();

      component.loadMoreReviews();

      expect(listSpy.calls.mostRecent().args).toEqual(['prod-1', 2]);
      expect(component.reviews().map((r) => r.uuid)).toEqual(['r1', 'r2']);
      expect(component.hasMoreReviews()).toBeFalse();
    });

    it('says "No reviews yet." when there are none', () => {
      setup('prod-1');
      load();
      spyOn(reviewService, 'listForProduct').and.returnValue(of({ items: [], meta: { totalCount: 0 } as never }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.pd-reviews__empty').textContent.trim()).toBe('No reviews yet.');
      expect(fixture.nativeElement.querySelector('.pd__rating')).toBeNull();
    });

    it('shows a message when reviews fail to load, without breaking the page', () => {
      setup('prod-1');
      load();
      spyOn(reviewService, 'listForProduct').and.returnValue(throwError(() => ({ code: 'X', message: 'Reviews are down' })));
      fixture.detectChanges();

      expect(component.reviewsError()).toBe('Reviews are down');
      expect(component.reviewsLoading()).toBeFalse();
      expect(component.product()?.uuid).toBe('prod-1');
    });

    it("shows the product's average rating and review count from the backend", () => {
      setup('prod-1');
      load({ ...makeDetail([makeVariant()]), rating: { average: 4.25, count: 12 } });
      spyOn(reviewService, 'listForProduct').and.returnValue(of({ items: [reviewItem('r1', 4)], meta: { totalCount: 12 } as never }));
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.pd__rating').textContent.replace(/\s+/g, ' ').trim();
      expect(badge).toMatch(/^4\.3 ★\s*12 reviews$/);
      expect(fixture.nativeElement.querySelector('.pd-reviews__summary').textContent).toContain('4.3 out of 5');
    });

    it('star helpers round and clamp', () => {
      setup('prod-1');
      expect(component.stars(3)).toBe('★★★☆☆');
      expect(component.roundStars(4.5)).toBe(5);
      expect(component.roundStars(7)).toBe(5);
      expect(component.roundStars(-1)).toBe(0);
    });
  });
});
