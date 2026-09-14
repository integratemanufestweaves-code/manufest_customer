import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ApplicationAssetService } from './application-asset.service';
import { environment } from '../../../environments/environment';

describe('ApplicationAssetService', () => {
  let service: ApplicationAssetService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/public/application-assets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApplicationAssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('assetSrc', () => {
    it('returns null for null/undefined/empty', () => {
      expect(service.assetSrc(null)).toBeNull();
      expect(service.assetSrc(undefined)).toBeNull();
      expect(service.assetSrc('')).toBeNull();
    });

    it('builds the same media-proxy shape ProductService.mediaSrc uses, on this service\'s own base path', () => {
      const raw = 'https://manufest-media-storage.s3.ap-south-1.amazonaws.com/application_asset/hero.jpg';
      expect(service.assetSrc(raw)).toBe(`${base}/media?url=${encodeURIComponent(raw)}`);
    });

    it('encodes special characters correctly', () => {
      const raw = 'https://s3.example.com/banner 1 & 2.png';
      const result = service.assetSrc(raw)!;
      expect(result).not.toContain('banner 1 & 2.png');
      const embedded = decodeURIComponent(result.split('url=')[1]);
      expect(embedded).toBe(raw);
    });
  });

  describe('getActive', () => {
    it('sends placementKey and omits category when not provided', () => {
      service.getActive('home_hero_banner').subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/active`);
      expect(req.request.params.get('placementKey')).toBe('home_hero_banner');
      expect(req.request.params.has('category')).toBeFalse();
      req.flush({ success: true, data: [] });
    });

    it('sends category when provided', () => {
      service.getActive('home_hero_banner', 'desktop').subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/active`);
      expect(req.request.params.get('category')).toBe('desktop');
      req.flush({ success: true, data: [] });
    });

    it('rethrows a structured error', () => {
      let error: any;
      service.getActive('home_hero_banner').subscribe({ error: (e) => (error = e) });
      const req = httpMock.expectOne((r) => r.url === `${base}/active`);
      req.flush({ success: false, error: { code: 'SERVER_ERROR', message: 'Boom' } }, { status: 500, statusText: 'Server Error' });
      expect(error.code).toBe('SERVER_ERROR');
    });
  });
});
