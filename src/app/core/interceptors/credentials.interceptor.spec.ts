import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { credentialsInterceptor } from './credentials.interceptor';
import { environment } from '../../../environments/environment';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function setCookie(name: string, value: string): void {
    document.cookie = `${name}=${value}; path=/`;
  }

  function clearCookie(name: string): void {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([credentialsInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    clearCookie(environment.csrfCookieName);
  });

  afterEach(() => {
    httpMock.verify();
    clearCookie(environment.csrfCookieName);
  });

  it('attaches withCredentials to a request targeting the API base URL', () => {
    http.get(`${environment.apiBaseUrl}/customer/cart`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('does not force withCredentials on a request to an unrelated origin', () => {
    http.get('https://unrelated-third-party.example.com/thing').subscribe();
    const req = httpMock.expectOne('https://unrelated-third-party.example.com/thing');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  it('does not attach a CSRF header to a safe GET request even if a token cookie exists', () => {
    setCookie(environment.csrfCookieName, 'token-abc');
    http.get(`${environment.apiBaseUrl}/public/products/list`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/public/products/list`);
    expect(req.request.headers.has(environment.csrfHeaderName)).toBeFalse();
    req.flush({});
  });

  it('attaches the CSRF header on an unsafe POST when the token cookie is present', () => {
    setCookie(environment.csrfCookieName, 'token-xyz');
    http.post(`${environment.apiBaseUrl}/customer/cart/items`, { variantUuid: 'v1' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart/items`);
    expect(req.request.headers.get(environment.csrfHeaderName)).toBe('token-xyz');
    req.flush({});
  });

  it('attaches the CSRF header on PUT and DELETE too, not just POST', () => {
    setCookie(environment.csrfCookieName, 'token-put');
    http.put(`${environment.apiBaseUrl}/customer/cart/items/item-1`, { quantity: 2 }).subscribe();
    const putReq = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart/items/item-1`);
    expect(putReq.request.headers.get(environment.csrfHeaderName)).toBe('token-put');
    putReq.flush({});

    http.delete(`${environment.apiBaseUrl}/customer/cart/items/item-1`).subscribe();
    const delReq = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart/items/item-1`);
    expect(delReq.request.headers.get(environment.csrfHeaderName)).toBe('token-put');
    delReq.flush({});
  });

  it('does not attach a CSRF header on an unsafe request when no token cookie exists yet', () => {
    http.post(`${environment.apiBaseUrl}/customer/cart/items`, {}).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart/items`);
    expect(req.request.headers.has(environment.csrfHeaderName)).toBeFalse();
    req.flush({});
  });

  it('reads only the named CSRF cookie, not an unrelated cookie with a similar name', () => {
    setCookie('NOT-' + environment.csrfCookieName, 'wrong-token');
    http.post(`${environment.apiBaseUrl}/customer/cart/items`, {}).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/customer/cart/items`);
    expect(req.request.headers.has(environment.csrfHeaderName)).toBeFalse();
    req.flush({});
    clearCookie('NOT-' + environment.csrfCookieName);
  });
});
