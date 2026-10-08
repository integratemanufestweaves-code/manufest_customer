import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { AuthService } from './auth.service';

/**
 * Bump when the Terms of Use, Privacy Policy or the cookie categories change
 * in a way people must agree to again. A stored cookie choice made under an
 * older version is treated as "not decided", so the banner comes back.
 */
export const POLICY_VERSION = '2026-10-08';

export interface CookiePreferences {
  /** Google Analytics + Manufest's own Site Analytics (visits, pages, live presence). */
  analytics: boolean;
  /** Google's advertising signals (measuring ads, remarketing). */
  ads: boolean;
}

interface StoredChoice extends CookiePreferences {
  version: string;
  decidedAt: string;
}

export type ConsentSource = 'login' | 'signup' | 'cookie_banner' | 'account';

export interface ConsentRecord {
  type: 'terms' | 'privacy' | 'marketing' | 'analytics_cookies' | 'ad_cookies';
  granted: boolean;
  policyVersion: string;
  source: ConsentSource;
  decidedAt: string;
}

const STORAGE_KEY = 'mf_cookie_consent';

function readStoredChoice(): StoredChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredChoice) : null;
    return parsed && parsed.version === POLICY_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The visitor's cookie choice (banner / privacy page) and the signed-in
 * customer's recorded consents.
 *
 * The cookie choice lives in this browser (`localStorage`), so it works for
 * guests. When a customer is signed in, every choice is also written to
 * manufest_be's append-only `customer_consents` log (`POST
 * /customer/consents`) along with the Terms/Privacy agreement and the
 * optional offers opt-in from the sign-in screen. That server-side record is
 * the proof India's DPDP Act asks for; the local copy is just what the
 * browser acts on.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiBaseUrl}/customer/consents`;

  private readonly choice = signal<StoredChoice | null>(readStoredChoice());

  /** False until the visitor picks something in the banner. */
  readonly decided = computed(() => this.choice() !== null);
  readonly preferences = computed<CookiePreferences>(() => {
    const choice = this.choice();
    return { analytics: choice?.analytics ?? false, ads: choice?.ads ?? false };
  });
  readonly analyticsAllowed = computed(() => this.preferences().analytics);
  readonly adsAllowed = computed(() => this.preferences().ads);

  /** "Cookie settings" (footer / privacy page) re-opens the preferences dialog. */
  readonly preferencesOpen = signal(false);

  saveCookiePreferences(preferences: CookiePreferences, source: ConsentSource = 'cookie_banner'): void {
    const choice: StoredChoice = { ...preferences, version: POLICY_VERSION, decidedAt: new Date().toISOString() };
    this.choice.set(choice);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Storage blocked: the choice still holds for this page load.
    }
    if (this.auth.isAuthenticated()) this.syncCookiePreferences(source).subscribe();
  }

  /** Copies this browser's cookie choice to the signed-in customer's record
   * (after sign-in, so a choice made as a guest is on file too). */
  syncCookiePreferences(source: ConsentSource = 'cookie_banner'): Observable<ConsentRecord[] | null> {
    const choice = this.choice();
    if (!choice) return of(null);
    return this.record(
      [
        { type: 'analytics_cookies', granted: choice.analytics },
        { type: 'ad_cookies', granted: choice.ads },
      ],
      source,
    );
  }

  /** Sign-in / sign-up checkbox: Terms + Privacy (required to continue) and
   * the optional offers opt-in. */
  recordAccountConsents(marketing: boolean, source: 'login' | 'signup'): Observable<ConsentRecord[] | null> {
    return this.record(
      [
        { type: 'terms', granted: true },
        { type: 'privacy', granted: true },
        { type: 'marketing', granted: marketing },
      ],
      source,
    );
  }

  setMarketing(granted: boolean): Observable<ConsentRecord[] | null> {
    return this.record([{ type: 'marketing', granted }], 'account');
  }

  /** The signed-in customer's current consents (latest decision per type). */
  list(): Observable<ConsentRecord[]> {
    return this.http.get<ApiSuccess<ConsentRecord[]>>(this.base).pipe(map((res) => res.data));
  }

  /** Best effort: a failed write never blocks the customer. Errors resolve to null. */
  private record(consents: Array<{ type: ConsentRecord['type']; granted: boolean }>, source: ConsentSource): Observable<ConsentRecord[] | null> {
    return this.http
      .post<ApiSuccess<ConsentRecord[]>>(this.base, { consents, policyVersion: POLICY_VERSION, source })
      .pipe(
        map((res) => res.data),
        catchError(() => of(null)),
      );
  }
}
