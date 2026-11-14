import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CHROME_HIDDEN_CLASS, ScrollChromeService } from './scroll-chrome.service';

describe('ScrollChromeService', () => {
  let service: ScrollChromeService;
  const hidden = () => document.documentElement.classList.contains(CHROME_HIDDEN_CLASS);

  /** Scrolls through each position in turn, on a phone. */
  const scrollTo = (...ys: number[]) => ys.forEach((y) => service.onScroll(y, true));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(ScrollChromeService);
    (service as unknown as { routeEnabled: boolean }).routeEnabled = true;
  });

  afterEach(() => document.documentElement.classList.remove(CHROME_HIDDEN_CLASS));

  it('hides the header once scrolled down past the top zone', () => {
    scrollTo(0, 150, 170);
    expect(hidden()).toBeTrue();
  });

  it('keeps the header near the top of the page', () => {
    scrollTo(0, 40, 90);
    expect(hidden()).toBeFalse();
  });

  it('ignores a small flick up, but shows the header on a real scroll up', () => {
    scrollTo(0, 400, 600);
    scrollTo(580);
    expect(hidden()).toBeTrue();
    scrollTo(520);
    expect(hidden()).toBeFalse();
  });

  it('always shows the header on the way back into the top zone', () => {
    scrollTo(0, 400, 600, 590, 80);
    expect(hidden()).toBeFalse();
  });

  it('does nothing on desktop widths', () => {
    [0, 400, 800].forEach((y) => service.onScroll(y, false));
    expect(hidden()).toBeFalse();
  });

  it('does nothing on routes that did not opt in', () => {
    (service as unknown as { routeEnabled: boolean }).routeEnabled = false;
    scrollTo(0, 400, 800);
    expect(hidden()).toBeFalse();
  });
});
