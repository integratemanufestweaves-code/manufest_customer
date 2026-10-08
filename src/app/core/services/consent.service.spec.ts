import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ConsentService, POLICY_VERSION } from './consent.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('ConsentService', () => {
  const url = `${environment.apiBaseUrl}/customer/consents`;
  let httpMock: HttpTestingController;

  function create(signedIn: boolean): ConsentService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'isAuthenticated').and.returnValue(signedIn);
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ConsentService);
  }

  beforeEach(() => localStorage.removeItem('mf_cookie_consent'));
  afterEach(() => localStorage.removeItem('mf_cookie_consent'));

  it('starts undecided with every optional cookie off', () => {
    const service = create(false);
    expect(service.decided()).toBeFalse();
    expect(service.preferences()).toEqual({ analytics: false, ads: false });
  });

  it("a guest's choice is kept in this browser only", () => {
    const service = create(false);
    service.saveCookiePreferences({ analytics: true, ads: false });
    expect(service.analyticsAllowed()).toBeTrue();
    expect(JSON.parse(localStorage.getItem('mf_cookie_consent')!)).toEqual(jasmine.objectContaining({ analytics: true, ads: false, version: POLICY_VERSION }));
    httpMock.expectNone(url);
  });

  it("a signed-in customer's choice is also recorded on the server", () => {
    const service = create(true);
    service.saveCookiePreferences({ analytics: false, ads: true });
    const req = httpMock.expectOne(url);
    expect(req.request.body).toEqual({
      consents: [
        { type: 'analytics_cookies', granted: false },
        { type: 'ad_cookies', granted: true },
      ],
      policyVersion: POLICY_VERSION,
      source: 'cookie_banner',
    });
    req.flush({ success: true, data: [] });
  });

  it('a choice made under an older policy version asks again', () => {
    localStorage.setItem('mf_cookie_consent', JSON.stringify({ analytics: true, ads: true, version: '2000-01-01', decidedAt: '' }));
    const service = create(false);
    expect(service.decided()).toBeFalse();
  });
});
