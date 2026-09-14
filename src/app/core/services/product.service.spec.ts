import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ProductService } from './product.service';
import { environment } from '../../../environments/environment';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/public/products`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('mediaSrc', () => {
    it('returns null for null', () => {
      expect(service.mediaSrc(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(service.mediaSrc(undefined)).toBeNull();
    });

    it('returns null for an empty string (falsy, same branch as null/undefined)', () => {
      expect(service.mediaSrc('')).toBeNull();
    });

    it('builds a proxy URL that embeds the encoded raw URL', () => {
      const raw = 'https://manufest-media-storage.s3.ap-south-1.amazonaws.com/product-media/images/a.jpg';
      const result = service.mediaSrc(raw);
      expect(result).toBe(`${base}/media?url=${encodeURIComponent(raw)}`);
    });

    it('percent-encodes special/reserved characters in the raw URL (spaces, &, ?, +, #)', () => {
      const raw = 'https://s3.example.com/path with spaces/name+plus?query=a&b=c#frag';
      const result = service.mediaSrc(raw)!;
      // The raw URL must not appear verbatim/unescaped inside the query string.
      expect(result).not.toContain('path with spaces');
      expect(result).not.toContain('name+plus?query=a&b=c');
      expect(result).toBe(`${base}/media?url=${encodeURIComponent(raw)}`);
      // Round-trips back to the exact original.
      const embedded = result.split('url=')[1];
      expect(decodeURIComponent(embedded)).toBe(raw);
    });

    it('does not double-encode a URL that already contains percent-encoded sequences', () => {
      const raw = 'https://s3.example.com/already%20encoded.jpg';
      const result = service.mediaSrc(raw)!;
      const embedded = decodeURIComponent(result.split('url=')[1]);
      expect(embedded).toBe(raw);
    });

    it('is safe against a raw URL containing an encoded-URI-breaking sequence (script-ish payload) — output stays a single query param, not executable markup', () => {
      const raw = 'https://s3.example.com/"><script>alert(1)</script>.jpg';
      const result = service.mediaSrc(raw)!;
      expect(result).not.toContain('<script>');
      expect(result).toContain('media?url=');
    });
  });

  describe('listProducts', () => {
    it('sends only the params that were actually provided', () => {
      service.listProducts({ limit: 10 }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/list`);
      expect(req.request.params.keys().sort()).toEqual(['limit']);
      req.flush({ success: true, data: [], meta: { limit: 10, nextCursor: null, hasMore: false } });
    });

    it('forwards categoryUuid/priceMin/priceMax/sort together (AND-combinable)', () => {
      service.listProducts({ categoryUuid: 'cat-1', priceMin: 1000, priceMax: 5000, sort: 'oldest' }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/list`);
      expect(req.request.params.get('categoryUuid')).toBe('cat-1');
      expect(req.request.params.get('priceMin')).toBe('1000');
      expect(req.request.params.get('priceMax')).toBe('5000');
      expect(req.request.params.get('sort')).toBe('oldest');
      req.flush({ success: true, data: [] });
    });

    it('falls back to a synthetic meta object when the server omits it', () => {
      let result: any;
      service.listProducts({ limit: 7 }).subscribe((r) => (result = r));
      const req = httpMock.expectOne((r) => r.url === `${base}/list`);
      req.flush({ success: true, data: [] });
      expect(result.meta).toEqual({ limit: 7, nextCursor: null, hasMore: false });
    });

    it('normalizes a structured API error via rethrow', () => {
      let error: any;
      service.listProducts().subscribe({ error: (e) => (error = e) });
      const req = httpMock.expectOne((r) => r.url === `${base}/list`);
      req.flush(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid filter' } },
        { status: 400, statusText: 'Bad Request' },
      );
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid filter');
    });

    it('normalizes a network-level failure (no structured body) to NETWORK_ERROR', () => {
      let error: any;
      service.listProducts().subscribe({ error: (e) => (error = e) });
      const req = httpMock.expectOne((r) => r.url === `${base}/list`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('getProductDetail', () => {
    it('requests the correct detail URL and unwraps data', () => {
      let result: any;
      service.getProductDetail('prod-1').subscribe((r) => (result = r));
      const req = httpMock.expectOne(`${base}/detail/prod-1`);
      req.flush({ success: true, data: { uuid: 'prod-1' } });
      expect(result.uuid).toBe('prod-1');
    });
  });
});
