import { TestBed } from '@angular/core/testing';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router, Scroll, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { provideScrollRestoration } from './scroll-restoration';

describe('provideScrollRestoration', () => {
  let events: Subject<unknown>;
  let scroller: ViewportScroller;
  let scrollTo: jasmine.Spy;
  let spacer: HTMLDivElement;

  const end = new NavigationEnd(1, '/a', '/a');
  const frames = (n: number) => new Promise<void>((resolve) => {
    const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  /** Makes the page `px` tall, as if the route's HTTP data just rendered. */
  const setPageHeight = (px: number) => (spacer.style.height = `${px}px`);

  beforeEach(() => {
    spacer = document.createElement('div');
    document.body.appendChild(spacer);
    setPageHeight(0);

    TestBed.configureTestingModule({ providers: [provideRouter([]), provideScrollRestoration()] });
    scroller = TestBed.inject(ViewportScroller);
    spyOn(scroller, 'scrollToPosition');
    scrollTo = spyOn(window, 'scrollTo');
    // Router.events is backed by a Subject; push Scroll events straight in.
    events = TestBed.inject(Router).events as Subject<unknown>;
  });

  afterEach(() => spacer.remove());

  it('scrolls to the top on a new navigation', () => {
    events.next(new Scroll(end, null, null));
    expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
  });

  it('leaves #fragment links to the Router (no reset to top)', () => {
    events.next(new Scroll(end, null, 'reviews'));
    expect(scroller.scrollToPosition).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('restores the saved position on back/forward when the page is already tall enough', () => {
    setPageHeight(5000);
    events.next(new Scroll(end, [0, 1200], null));
    expect(scrollTo).toHaveBeenCalledWith(0, 1200);
    expect(scroller.scrollToPosition).not.toHaveBeenCalled();
  });

  it('keeps retrying until the content loads, then lands on the saved position', async () => {
    events.next(new Scroll(end, [0, 1200], null));
    await frames(3);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 1200);

    setPageHeight(5000);
    await frames(3);
    expect(scrollTo.calls.mostRecent().args).toEqual([0, 1200]);
  });

  it('stops restoring as soon as the visitor scrolls themselves', async () => {
    events.next(new Scroll(end, [0, 1200], null));
    window.dispatchEvent(new Event('wheel'));
    setPageHeight(5000);
    await frames(3);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 1200);
  });

  it('a newer navigation cancels a pending restore', async () => {
    events.next(new Scroll(end, [0, 1200], null));
    events.next(new Scroll(new NavigationEnd(2, '/b', '/b'), null, null));
    setPageHeight(5000);
    await frames(3);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 1200);
    expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
  });
});
