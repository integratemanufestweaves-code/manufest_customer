import { appConfig } from './app.config';

/**
 * Regression guard for a real bug fixed this session: `provideRouter` was
 * missing `withInMemoryScrolling({ scrollPositionRestoration: 'top' })`, so
 * the Router never reset scroll position on navigation — landing on a
 * shorter destination page at the *previous* page's scroll offset, which
 * could already be past the new page's content and into the footer
 * ("clicking anything jumps to the footer").
 *
 * `provideRouter(...)`'s return value is an opaque array of Angular
 * providers/EnvironmentProviders with no public API to introspect which
 * router *features* were passed in (the feature objects don't survive as
 * inspectable data once turned into providers) — so a black-box provider
 * inspection can't assert "scrollPositionRestoration is 'top'" the way a
 * plain object could. Two complementary checks instead: a structural sanity
 * check that `appConfig.providers` isn't empty/broken, and a source-level
 * check (fetching the real `app.config.ts` this app ships, served via a
 * `test` target `assets` entry added specifically for this — see
 * angular.json) that the actual call site still passes both scroll options.
 * A future edit that drops `withInMemoryScrolling(...)` (or waters down its
 * options) fails this suite instead of shipping silently, same guard shape
 * as this app's `csp.spec.ts`.
 */
describe('appConfig', () => {
  it('provides a non-empty provider list', () => {
    expect(Array.isArray(appConfig.providers)).toBeTrue();
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });

  describe('router scroll restoration (source-level regression guard)', () => {
    let source: string;

    beforeAll(async () => {
      const res = await fetch('/app.config.ts');
      expect(res.ok).toBeTrue();
      source = await res.text();
    });

    it('calls provideRouter with withInMemoryScrolling(...)', () => {
      expect(source).toMatch(/provideRouter\(\s*routes\s*,\s*withInMemoryScrolling\(/);
    });

    it("sets scrollPositionRestoration to 'top'", () => {
      expect(source).toMatch(/scrollPositionRestoration:\s*'top'/);
    });

    it("keeps anchorScrolling 'enabled' for in-page #fragment links", () => {
      expect(source).toMatch(/anchorScrolling:\s*'enabled'/);
    });

    it('imports withInMemoryScrolling from @angular/router', () => {
      expect(source).toMatch(/import\s*\{[^}]*withInMemoryScrolling[^}]*\}\s*from\s*['"]@angular\/router['"]/);
    });
  });
});
