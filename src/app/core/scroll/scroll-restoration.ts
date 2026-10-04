import { DestroyRef, ENVIRONMENT_INITIALIZER, EnvironmentProviders, NgZone, inject, makeEnvironmentProviders } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { Router, Scroll } from '@angular/router';
import { filter } from 'rxjs';

/** How long a back/forward restore keeps waiting for the page to grow tall
 * enough (its data arriving over HTTP) before giving up where it is. */
const RESTORE_TIMEOUT_MS = 3000;

/**
 * Scroll handling for router navigations; pair it with
 * `withInMemoryScrolling({ scrollPositionRestoration: 'disabled' })`, which
 * still records each page's position and emits it on back/forward.
 *
 * - New navigation (link click): start at the top of the next page.
 * - Back/forward: return to where the visitor was on that page.
 * - `#fragment` links: left to the Router's own `anchorScrolling`.
 *
 * The Router's built-in `'enabled'` restores once, as soon as the route
 * renders. Every list/detail page here loads its content over HTTP after
 * that, so at that moment the page is still too short to scroll to the old
 * offset and the browser clamps it to the top. This retries each frame
 * until the page is tall enough, and stops early if the visitor scrolls or
 * taps first so it never fights them.
 */
export function provideScrollRestoration(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const router = inject(Router);
        const scroller = inject(ViewportScroller);
        const zone = inject(NgZone);
        const destroyRef = inject(DestroyRef);

        if (typeof window === 'undefined') return;
        // The browser's own restoration would jump before the content
        // exists and then fight the retries below.
        scroller.setHistoryScrollRestoration('manual');

        let cancelPending: (() => void) | null = null;

        const sub = router.events.pipe(filter((e): e is Scroll => e instanceof Scroll)).subscribe((e) => {
          cancelPending?.();
          cancelPending = null;
          if (e.position) {
            cancelPending = zone.runOutsideAngular(() => restore(e.position as [number, number]));
          } else if (!e.anchor) {
            scroller.scrollToPosition([0, 0]);
          }
        });

        destroyRef.onDestroy(() => {
          cancelPending?.();
          sub.unsubscribe();
        });
      },
    },
  ]);
}

/** Scrolls to `[x, y]` once the page can reach it; returns a cancel fn. */
function restore([x, y]: [number, number]): () => void {
  const deadline = Date.now() + RESTORE_TIMEOUT_MS;
  let frame = 0;
  const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

  const stop = () => {
    cancelAnimationFrame(frame);
    userEvents.forEach((type) => window.removeEventListener(type, stop));
  };

  const tick = () => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(x, Math.min(y, Math.max(0, maxY)));
    if (maxY >= y || Date.now() >= deadline) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  userEvents.forEach((type) => window.addEventListener(type, stop, { passive: true }));
  tick();
  return stop;
}
