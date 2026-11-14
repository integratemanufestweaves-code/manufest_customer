import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Set on <html> while the header is slid away. Header and listing styles
 * key off it (and the `--chrome-top` it switches in styles.scss). */
export const CHROME_HIDDEN_CLASS = 'chrome-hidden';

/** Phones only — same breakpoint the header stacks its search bar at. */
const MOBILE_QUERY = '(max-width: 767px)';
/** Always show the header this close to the top of the page. */
const TOP_ZONE_PX = 100;
/** Scroll down this far to hide it… */
const HIDE_AFTER_DOWN_PX = 10;
/** …and back up this far to bring it back (a small flick doesn't count). */
const SHOW_AFTER_UP_PX = 50;

/**
 * On phones, the header (logo, icons, search) slides away while the
 * customer scrolls down a product list and slides back on a short scroll
 * up, so products get the whole screen. Listing pages also pin a thin
 * Filters/Sort bar that moves up into the header's place.
 *
 * Only on routes with `data: { autoHideChrome: true }` (home and the
 * product listing routes); everywhere else — product page, cart, checkout —
 * the header stays put. Never hides while focus is in the header (search
 * box open with the keyboard up). Started once from AppComponent.
 */
@Injectable({ providedIn: 'root' })
export class ScrollChromeService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private started = false;
  private routeEnabled = false;
  private lastY = 0;
  private downDistance = 0;
  private upDistance = 0;

  start(): void {
    const view = this.document.defaultView;
    if (this.started || !view?.matchMedia) return;
    this.started = true;
    const mobile = view.matchMedia(MOBILE_QUERY);

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.routeEnabled = this.deepestRouteData(this.router.routerState.snapshot.root);
      this.reset(view.scrollY);
    });

    // Class toggles only — no change detection needed per scroll event.
    this.zone.runOutsideAngular(() => {
      view.addEventListener('scroll', () => this.onScroll(view.scrollY, mobile.matches), { passive: true });
      mobile.addEventListener?.('change', () => this.reset(view.scrollY));
    });
  }

  /** Exposed for tests; the scroll listener calls it with the live values. */
  onScroll(y: number, isMobile: boolean): void {
    const dy = y - this.lastY;
    this.lastY = y;

    if (!this.routeEnabled || !isMobile || y < TOP_ZONE_PX || this.headerHasFocus()) {
      this.downDistance = 0;
      this.upDistance = 0;
      this.setHidden(false);
      return;
    }

    if (dy > 0) {
      this.upDistance = 0;
      this.downDistance += dy;
      if (this.downDistance > HIDE_AFTER_DOWN_PX) this.setHidden(true);
    } else if (dy < 0) {
      this.downDistance = 0;
      this.upDistance -= dy;
      if (this.upDistance > SHOW_AFTER_UP_PX) this.setHidden(false);
    }
  }

  private reset(y: number): void {
    this.lastY = y;
    this.downDistance = 0;
    this.upDistance = 0;
    this.setHidden(false);
  }

  private setHidden(hidden: boolean): void {
    this.document.documentElement.classList.toggle(CHROME_HIDDEN_CLASS, hidden);
  }

  private headerHasFocus(): boolean {
    return !!this.document.activeElement?.closest('.header');
  }

  private deepestRouteData(route: ActivatedRouteSnapshot): boolean {
    let current = route;
    while (current.firstChild) current = current.firstChild;
    return current.data['autoHideChrome'] === true;
  }
}
