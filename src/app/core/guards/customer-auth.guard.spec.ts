import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';

import { customerAuthGuard } from './customer-auth.guard';
import { AuthService } from '../services/auth.service';

/**
 * `customerAuthGuard` gates `/account`, `/cart`, `/wishlist`, `/checkout`,
 * `/orders`, `/orders/:orderUuid` (see app.routes.ts) — every one of those
 * server-side routes requires `authenticateCustomer`. This spec runs the
 * guard function directly (`CanActivateFn`) inside an injection context via
 * `TestBed.runInInjectionContext`, the documented way to unit test a
 * functional guard without standing up full router navigation.
 */
describe('customerAuthGuard', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  function runGuard(url: string): boolean | UrlTree {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => customerAuthGuard(route, state)) as boolean | UrlTree;
  }

  const protectedUrls = ['/account', '/cart', '/wishlist', '/checkout', '/orders', '/orders/order-123'];

  for (const url of protectedUrls) {
    it(`redirects an unauthenticated visitor away from ${url}`, () => {
      expect(authService.isAuthenticated()).toBeFalse();
      const result = runGuard(url);
      expect(result).not.toBeTrue();
      expect(result instanceof UrlTree).toBeTrue();
    });

    it(`redirect UrlTree for ${url} points at /login with redirectTo set to the original url`, () => {
      const result = runGuard(url) as UrlTree;
      const tree = router.parseUrl(router.serializeUrl(result));
      expect(tree.root.children['primary']?.segments.map((s) => s.path).join('/')).toBe('login');
      expect(tree.queryParams['redirectTo']).toBe(url);
    });
  }

  it('allows navigation through once a session is established', () => {
    (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A B' });
    expect(authService.isAuthenticated()).toBeTrue();
    const result = runGuard('/cart');
    expect(result).toBeTrue();
  });

  it('goes back to denying once the session is cleared (logout mid-session)', () => {
    (authService as any).currentUserSignal.set({ id: 'u1', email: 'a@b.com', fullName: 'A B' });
    expect(runGuard('/cart')).toBeTrue();

    authService.clearLocalSession();
    const result = runGuard('/cart');
    expect(result).not.toBeTrue();
  });
});
