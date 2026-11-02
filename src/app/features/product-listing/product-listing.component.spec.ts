import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ProductListingComponent } from './product-listing.component';
import { ProductService } from '../../core/services/product.service';
import { ProductSummary } from '../../core/models/product.models';
import { PRICE_BANDS, ProductFilters } from '../../core/models/product-filters.models';

function makeFilters(overrides: Partial<ProductFilters> = {}): ProductFilters {
  return {
    categories: [],
    brands: [],
    colors: [],
    fabricPurities: [],
    materials: [],
    zariColors: [],
    zariTypes: [],
    borderTypes: [],
    occasions: [],
    fabrics: [],
    weaves: [],
    origins: [],
    blouse: { with: 0, without: 0 },
    discounts: [],
    ...overrides,
  };
}

/** Not rendered (no detectChanges), so ngOnInit's API calls never fire —
 * these drive the component's own state directly. */
describe('ProductListingComponent', () => {
  let fixture: ComponentFixture<ProductListingComponent>;
  let component: ProductListingComponent;
  let navigateSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductListingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(ProductListingComponent);
    component = fixture.componentInstance;
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  const facetSections = (): string[] =>
    component
      .sections()
      .filter((s): s is Extract<typeof s, { kind: 'facet' }> => s.kind === 'facet')
      .map((s) => s.group.definition.facet);

  describe('when a search finds nothing', () => {
    const product = { uuid: 'p-1' } as ProductSummary;
    const emptyPage = { items: [], meta: { limit: 20, nextCursor: null, hasMore: false } };
    let service: ProductService;

    const search = () => (component as unknown as { fetchProducts(append: boolean): void }).fetchProducts(false);

    beforeEach(() => {
      service = TestBed.inject(ProductService);
      component.searchQuery.set('zzz');
    });

    it('shows the trending products', () => {
      spyOn(service, 'listProducts').and.returnValue(of(emptyPage));
      spyOn(service, 'getTrendingProducts').and.returnValue(of([product]));
      search();
      expect(component.trending()).toEqual([product]);
      expect(component.loading()).toBeFalse();
    });

    it('stays in its loading state until they arrive', () => {
      const trending = new Subject<ProductSummary[]>();
      spyOn(service, 'listProducts').and.returnValue(of(emptyPage));
      spyOn(service, 'getTrendingProducts').and.returnValue(trending);
      search();
      expect(component.loading()).toBeTrue();
      trending.next([product]);
      expect(component.loading()).toBeFalse();
    });

    it('falls back to the plain message when they fail', () => {
      spyOn(service, 'listProducts').and.returnValue(of(emptyPage));
      spyOn(service, 'getTrendingProducts').and.returnValue(throwError(() => new Error('down')));
      search();
      expect(component.trending()).toEqual([]);
      expect(component.loading()).toBeFalse();
    });

    it('ignores a trending reply once a newer search has started', () => {
      const trending = new Subject<ProductSummary[]>();
      const list = spyOn(service, 'listProducts').and.returnValue(of(emptyPage));
      spyOn(service, 'getTrendingProducts').and.returnValue(trending);
      search();
      list.and.returnValue(of({ ...emptyPage, items: [product] }));
      search();
      trending.next([product]);
      expect(component.trending()).toEqual([]);
      expect(component.products()).toEqual([product]);
    });

    it('does not apply to filters with no search term', () => {
      component.searchQuery.set(null);
      spyOn(service, 'listProducts').and.returnValue(of(emptyPage));
      const trending = spyOn(service, 'getTrendingProducts');
      search();
      expect(trending).not.toHaveBeenCalled();
      expect(component.loading()).toBeFalse();
    });
  });

  describe('Origin filter is hidden', () => {
    it('no Origin group even when origins have products', () => {
      component.filters.set(
        makeFilters({
          origins: [{ value: 'tenkasi', name: 'Tenkasi', productCount: 10 }],
          weaves: [{ uuid: 'w1', name: 'Handloom', productCount: 3 }],
        }),
      );
      expect(facetSections()).not.toContain('origin');
      expect(facetSections()).toContain('weave');
    });
  });

  describe('price filter', () => {
    it('offers the shared PRICE_BANDS', () => {
      expect(component.priceOptions).toBe(PRICE_BANDS);
    });

    it('selecting an "Under" band sets priceMax and clears priceMin', () => {
      component.togglePrice(PRICE_BANDS[1]);
      expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual(jasmine.objectContaining({ priceMin: null, priceMax: 1000 }));
    });

    it('selecting "₹3,000 and above" sets priceMin and clears priceMax', () => {
      component.togglePrice(PRICE_BANDS[3]);
      expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual(jasmine.objectContaining({ priceMin: 3000, priceMax: null }));
    });

    it('a band is active only when both bounds match it', () => {
      component.priceMin.set(null);
      component.priceMax.set(1000);
      expect(component.isPriceActive(PRICE_BANDS[1])).toBeTrue();
      expect(component.isPriceActive(PRICE_BANDS[2])).toBeFalse();

      component.priceMin.set(500);
      expect(component.isPriceActive(PRICE_BANDS[1])).toBeFalse();
    });

    it('clicking the active band again clears the price filter', () => {
      component.priceMin.set(3000);
      component.priceMax.set(null);
      component.togglePrice(PRICE_BANDS[3]);
      expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual(jasmine.objectContaining({ priceMin: null, priceMax: null }));
    });
  });
});
