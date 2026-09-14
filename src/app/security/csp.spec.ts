/**
 * Regression guard for `src/index.html`'s CSP `<meta>` tag.
 *
 * This app had a real incident where the entire CSP was accidentally
 * replaced with a literal, no-op `content="..."` placeholder — syntactically
 * valid HTML, so nothing in the normal build/lint pipeline caught it, and
 * the app "worked" in the sense that it still rendered (a meta CSP with a
 * literal ellipsis string is simply ignored by the browser as an
 * unparseable policy, which is equivalent to having no CSP at all). This
 * spec fetches the real `index.html` the app ships (served here via a
 * `test` target `assets` entry added specifically for this — see
 * angular.json) and asserts on the actual policy string, so a future
 * accidental placeholder/removal fails the suite instead of shipping
 * silently.
 */
describe('index.html Content-Security-Policy', () => {
  let html: string;

  beforeAll(async () => {
    const res = await fetch('/index.html');
    expect(res.ok).toBeTrue();
    html = await res.text();
  });

  function cspContent(): string {
    const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
    expect(match).withContext('expected a Content-Security-Policy <meta> tag in index.html').not.toBeNull();
    return match ? match[1] : '';
  }

  it('is not the accidental literal no-op placeholder', () => {
    const content = cspContent();
    // The historical incident: content="..." (or similarly obviously-fake
    // placeholder text) instead of a real policy.
    expect(content).not.toBe('...');
    expect(content).not.toContain('...');
    expect(content.length).toBeGreaterThan(40);
  });

  it('declares directives, each with at least one source', () => {
    const content = cspContent();
    const directives = content
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean);
    expect(directives.length).toBeGreaterThan(3);
    for (const directive of directives) {
      const parts = directive.split(/\s+/);
      // A directive must be "name value..." — a bare name with nothing
      // after it (or an empty string from a stray ';;') means the policy
      // is malformed/truncated.
      expect(parts.length).withContext(`directive "${directive}" has no value`).toBeGreaterThan(1);
    }
  });

  it('restricts default-src and script-src to self', () => {
    const content = cspContent();
    expect(content).toMatch(/default-src\s+'self'/);
    expect(content).toMatch(/script-src\s+'self'/);
  });

  it('does not allow unsafe-inline or unsafe-eval on script-src', () => {
    const content = cspContent();
    const scriptSrcMatch = content.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    const scriptSrc = scriptSrcMatch ? scriptSrcMatch[1] : '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(scriptSrc).not.toContain('*');
  });

  it('restricts object-src to none and base-uri to self (clickjacking/injection hardening)', () => {
    const content = cspContent();
    expect(content).toMatch(/object-src\s+'none'/);
    expect(content).toMatch(/base-uri\s+'self'/);
  });

  it('restricts form-action to self', () => {
    const content = cspContent();
    expect(content).toMatch(/form-action\s+'self'/);
  });

  it('has a Referrer-Policy meta tag', () => {
    expect(html).toMatch(/<meta\s+http-equiv="Referrer-Policy"\s+content="[^"]+"/i);
  });
});
