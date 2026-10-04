import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { HeaderComponent } from './header.component';
import { PRICE_BANDS, ProductFilters } from '../../core/models/product-filters.models';

function makeFilters(): ProductFilters {
  return {
    categories: [{ uuid: 'c1', name: 'Sarees', productCount: 4 }],
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
    origins: [{ value: 'tenkasi', name: 'Tenkasi', productCount: 10 }],
    blouse: { with: 0, without: 0 },
    discounts: [],
  };
}

/** Not rendered (no detectChanges), so ngOnInit's filter fetch never fires. */
describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('hides the Origin menu (desktop nav and mobile drawer share navLinks)', () => {
    expect(component.navLinks.map((l) => l.label)).toEqual(['New Arrivals', 'Fabric', 'Weave', 'Occasion']);
  });

  it('"Shop by Price" links use the shared PRICE_BANDS with the right query params', () => {
    (component as any).filters.set(makeFilters());
    const priceColumn = component.menuFor('new-arrivals').columns.find((c) => c.heading === 'Shop by Price')!;

    expect(priceColumn.links.map((l) => l.label)).toEqual(PRICE_BANDS.map((b) => b.label));
    expect(priceColumn.links.map((l) => l.queryParams)).toEqual([{ priceMax: 299 }, { priceMax: 1000 }, { priceMax: 2000 }, { priceMin: 3000 }]);
  });
});
