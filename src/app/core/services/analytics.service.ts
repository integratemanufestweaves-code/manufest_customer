import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ConsentService } from './consent.service';

type EventType = 'page_view' | 'product_view' | 'search' | 'add_to_cart' | 'begin_checkout';

interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
}

export interface AnalyticsItem {
  productUuid: string;
  name: string;
  price?: number | null;
  variant?: string | null;
  quantity?: number;
}

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const VISITOR_KEY = 'mf_visitor_id';
const SESSION_KEY = 'mf_session';
const HEARTBEAT_MS = 20 * 1000;
const GA_COOKIE_PATTERN = /^(_ga|_gid|_gat|_gcl)/;

interface SessionState {
  id: string;
  attribution: Attribution;
  isNewVisitor: boolean;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function storageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Blocked storage: ids then last for this page load only.
  }
}

/** utm_* from the landing URL, else the referring site (never our own host). */
function landingAttribution(): Attribution {
  const params = new URLSearchParams(location.search);
  const clip = (value: string | null) => (value ? value.trim().slice(0, 100) : undefined);
  const attribution: Attribution = {
    utmSource: clip(params.get('utm_source')),
    utmMedium: clip(params.get('utm_medium')),
    utmCampaign: clip(params.get('utm_campaign')),
  };
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    if (host && host !== location.hostname) attribution.referrerHost = host.slice(0, 100);
  } catch {
    // Malformed referrer: treat as direct.
  }
  return attribution;
}

/**
 * Storefront analytics, two destinations, both only after the visitor
 * accepts analytics cookies (ConsentService):
 *
 * 1. Google Analytics 4 (gtag.js) for full marketing reports, loaded
 *    lazily the first time consent is given and only when
 *    `environment.gaMeasurementId` is set. Sends GA4's standard e-commerce
 *    events (view_item, search, add_to_cart, begin_checkout, purchase).
 *    Ad signals follow the separate "ads" choice via Consent Mode.
 * 2. manufest_be's first-party Site Analytics (`/public/analytics/*`): the
 *    same events plus a heartbeat every 20s while the tab is visible, which
 *    is what powers the admin app's live "who's on the site now" view.
 *
 * Ids are random: a visitor id in localStorage, a session id per tab
 * session in sessionStorage. Nothing personal is sent. Every call is fire
 * and forget; analytics never breaks or slows a page.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly consent = inject(ConsentService);
  private readonly base = `${environment.apiBaseUrl}/public/analytics`;

  private started = false;
  private gaLoaded = false;
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private currentPath = '/';
  /** Whether the first navigation has happened (a page view is due). */
  private navigated = false;
  private analyticsWasAllowed = false;

  constructor() {
    // Follows the cookie choice live: accept -> load GA, start the
    // heartbeat and count the page they're on; withdraw -> stop both and
    // drop GA's cookies.
    effect(() => {
      const analytics = this.consent.analyticsAllowed();
      const ads = this.consent.adsAllowed();
      if (analytics) {
        this.loadGoogleAnalytics();
        this.startHeartbeat();
        if (!this.analyticsWasAllowed && this.navigated) setTimeout(() => this.pageView());
      } else {
        this.stopHeartbeat();
        this.clearGoogleAnalyticsCookies();
      }
      this.analyticsWasAllowed = analytics;
      this.gtag('consent', 'update', {
        analytics_storage: analytics ? 'granted' : 'denied',
        ad_storage: ads ? 'granted' : 'denied',
        ad_user_data: ads ? 'granted' : 'denied',
        ad_personalization: ads ? 'granted' : 'denied',
      });
    });
  }

  /** Call once at app start (AppComponent). */
  start(destroyRef: DestroyRef): void {
    if (this.started) return;
    this.started = true;

    const navigations = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((event) => {
      this.currentPath = event.urlAfterRedirects.split('#')[0].slice(0, 255) || '/';
      this.navigated = true;
      // The router sets document.title right after NavigationEnd.
      setTimeout(() => this.pageView());
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') this.heartbeat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    destroyRef.onDestroy(() => {
      navigations.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      this.stopHeartbeat();
    });
  }

  productView(item: AnalyticsItem): void {
    this.send('product_view', { productUuid: item.productUuid });
    this.gtag('event', 'view_item', { currency: 'INR', value: item.price ?? undefined, items: [this.gaItem(item)] });
  }

  search(term: string): void {
    const searchTerm = term.trim().slice(0, 100);
    if (!searchTerm) return;
    this.send('search', { searchTerm });
    this.gtag('event', 'search', { search_term: searchTerm });
  }

  addToCart(item: AnalyticsItem): void {
    const value = (item.price ?? 0) * (item.quantity ?? 1);
    this.send('add_to_cart', { productUuid: item.productUuid, value });
    this.gtag('event', 'add_to_cart', { currency: 'INR', value, items: [this.gaItem(item)] });
  }

  beginCheckout(value: number, items: AnalyticsItem[]): void {
    this.send('begin_checkout', { value });
    this.gtag('event', 'begin_checkout', { currency: 'INR', value, items: items.map((item) => this.gaItem(item)) });
  }

  /** GA only: Site Analytics counts orders from the orders table itself. */
  purchase(orderUuid: string, value: number, items: AnalyticsItem[]): void {
    this.gtag('event', 'purchase', { transaction_id: orderUuid, currency: 'INR', value, items: items.map((item) => this.gaItem(item)) });
  }

  private pageView(): void {
    this.send('page_view', { title: document.title.slice(0, 150) });
    this.gtag('event', 'page_view', { page_path: this.currentPath, page_title: document.title, page_location: location.href });
  }

  private heartbeat(): void {
    if (!this.consent.analyticsAllowed() || document.visibilityState !== 'visible') return;
    const session = this.session();
    this.post('heartbeat', {
      visitorId: this.visitorId(),
      sessionId: session.id,
      path: this.currentPath,
      title: document.title.slice(0, 150),
      attribution: session.attribution,
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatHandle !== null) return;
    this.heartbeatHandle = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle === null) return;
    clearInterval(this.heartbeatHandle);
    this.heartbeatHandle = null;
  }

  private send(type: EventType, extra: Record<string, unknown>): void {
    if (!this.consent.analyticsAllowed()) return;
    const session = this.session();
    this.post('events', {
      type,
      visitorId: this.visitorId(),
      sessionId: session.id,
      isNewVisitor: session.isNewVisitor,
      path: this.currentPath,
      attribution: session.attribution,
      ...extra,
    });
  }

  private post(endpoint: 'events' | 'heartbeat', body: Record<string, unknown>): void {
    this.http.post(`${this.base}/${endpoint}`, body).subscribe({ error: () => undefined });
  }

  private visitorId(): string {
    let id = storageGet(localStorage, VISITOR_KEY);
    if (!id) {
      id = newId();
      storageSet(localStorage, VISITOR_KEY, id);
    }
    return id;
  }

  /** One per tab session; its attribution is fixed by how the tab arrived. */
  private session(): SessionState {
    const saved = storageGet(sessionStorage, SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as SessionState;
      } catch {
        // Corrupt: start a new session below.
      }
    }
    const isNewVisitor = !storageGet(localStorage, VISITOR_KEY);
    this.visitorId();
    const session: SessionState = { id: newId(), attribution: landingAttribution(), isNewVisitor };
    storageSet(sessionStorage, SESSION_KEY, JSON.stringify(session));
    return session;
  }

  private gaItem(item: AnalyticsItem): Record<string, unknown> {
    return { item_id: item.productUuid, item_name: item.name, item_variant: item.variant ?? undefined, price: item.price ?? undefined, quantity: item.quantity ?? 1 };
  }

  /** Calls gtag only once GA is loaded (so nothing queues before consent). */
  private gtag(...args: unknown[]): void {
    if (this.gaLoaded && window.gtag) window.gtag(...args);
  }

  private loadGoogleAnalytics(): void {
    const id = environment.gaMeasurementId;
    if (this.gaLoaded || !id) return;
    this.gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    // gtag.js reads the `arguments` object, not an array: must be a plain function.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    // Page views are sent by hand on every Angular navigation.
    window.gtag('config', id, { send_page_view: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  /** On withdrawal, remove the cookies GA already set on our domain. */
  private clearGoogleAnalyticsCookies(): void {
    const domains = ['', location.hostname, `.${location.hostname.split('.').slice(-2).join('.')}`];
    document.cookie
      .split(';')
      .map((part) => part.split('=')[0].trim())
      .filter((name) => GA_COOKIE_PATTERN.test(name))
      .forEach((name) => {
        domains.forEach((domain) => {
          document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
        });
      });
  }
}
