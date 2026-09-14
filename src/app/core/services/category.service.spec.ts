import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { CategoryService } from './category.service';
import { environment } from '../../../environments/environment';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/public/categories`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps snake_case API rows to camelCase Category objects', () => {
    let result: any;
    service.listCategories().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${base}/list`);
    req.flush({
      success: true,
      data: [{ uuid: 'c1', name: 'Sarees', slug: 'sarees', image_url: 'https://s3/raw.jpg' }],
    });
    expect(result).toEqual([{ uuid: 'c1', name: 'Sarees', slug: 'sarees', imageUrl: 'https://s3/raw.jpg' }]);
  });

  it('maps a null image_url through to imageUrl: null', () => {
    let result: any;
    service.listCategories().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${base}/list`);
    req.flush({ success: true, data: [{ uuid: 'c1', name: 'Blouses', slug: 'blouses', image_url: null }] });
    expect(result[0].imageUrl).toBeNull();
  });

  it('getCategory hits list_by_id/:uuid and maps the single row', () => {
    let result: any;
    service.getCategory('cat-9').subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${base}/list_by_id/cat-9`);
    req.flush({ success: true, data: { uuid: 'cat-9', name: 'Dress Materials', slug: 'dress-materials', image_url: null } });
    expect(result.name).toBe('Dress Materials');
  });

  it('rethrows a structured API error', () => {
    let error: any;
    service.getCategory('missing').subscribe({ error: (e) => (error = e) });
    const req = httpMock.expectOne(`${base}/list_by_id/missing`);
    req.flush({ success: false, error: { code: 'NOT_FOUND', message: 'No such category' } }, { status: 404, statusText: 'Not Found' });
    expect(error.code).toBe('NOT_FOUND');
  });
});
