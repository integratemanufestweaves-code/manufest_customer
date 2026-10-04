import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { ProductListingComponent } from './product-listing.component';
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
