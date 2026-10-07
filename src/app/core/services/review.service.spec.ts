import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ReviewService } from './review.service';
import { environment } from '../../../environments/environment';

describe('ReviewService', () => {
  let service: ReviewService;
  let httpMock: HttpTestingController;
  const publicBase = `${environment.apiBaseUrl}/public/product-reviews`;
  const customerBase = `${environment.apiBaseUrl}/customer/product-reviews`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("listForProduct() pages through the product's public reviews and returns items + meta", () => {
    let result: unknown;
    service.listForProduct('prod-1', 2, 5).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === `${publicBase}/products/prod-1/reviews`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');
    const meta = { page: 2, limit: 5, totalCount: 6, totalPages: 2 };
    req.flush({ success: true, data: [{ uuid: 'r1', rating: 5 }], meta });

    expect(result).toEqual({ items: [{ uuid: 'r1', rating: 5 }], meta } as unknown);
  });

  it('listForProduct() defaults to page 1 of 10', () => {
    service.listForProduct('prod-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${publicBase}/products/prod-1/reviews`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ success: true, data: [], meta: {} });
  });

  it('create() POSTs the review to the customer route and returns it', () => {
    let created: unknown;
    service.create({ orderItemUuid: 'item-1', rating: 4, review: 'Lovely colour' }).subscribe((r) => (created = r));

    const req = httpMock.expectOne(customerBase);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ orderItemUuid: 'item-1', rating: 4, review: 'Lovely colour' });
    req.flush({ success: true, data: { uuid: 'r1', status: 'active' } });

    expect(created).toEqual({ uuid: 'r1', status: 'active' });
  });

  it('create() surfaces the API error code, e.g. ALREADY_REVIEWED', () => {
    let error: { code?: string } | undefined;
    service.create({ orderItemUuid: 'item-1', rating: 4 }).subscribe({ error: (e) => (error = e) });
    httpMock
      .expectOne(customerBase)
      .flush({ success: false, error: { code: 'ALREADY_REVIEWED', message: 'You already reviewed this item' } }, { status: 409, statusText: 'Conflict' });
    expect(error?.code).toBe('ALREADY_REVIEWED');
  });
});
