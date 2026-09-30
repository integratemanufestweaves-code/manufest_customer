import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import {
  CaptchaAnswer,
  CaptchaChallenge,
  CompleteSignupRequest,
  CompleteSignupResponse,
  CustomerProfile,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../models/auth.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `auth` module (`src/modules/auth/auth.api.js`,
 * mounted `/api/v1/auth/customer`) — see that file directly for exact
 * field names, not just `.claude/knowledge/02-api-reference.md`'s summary.
 * Same signal-based session-state shape as `manufest_seller`'s own
 * `AuthService` (`currentUser`/`isAuthenticated`), adapted to this app's
 * flattened `ApiError` convention (`api.models.ts`) instead of that repo's
 * nested one.
 *
 * All calls rely on `credentials.interceptor.ts` for `withCredentials` +
 * the CSRF double-submit header — nothing here touches cookies directly.
 *
 * One mobile-OTP flow for sign-in and sign-up (`requestOtp` → `verifyOtp`
 * → `completeSignup` for a new number). There is no email+password login,
 * registration or password reset; the backend routes were removed, not
 * just hidden. Every call that establishes a session returns the full
 * `GET /me` profile shape, so `currentUser` is populated directly from it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiBaseUrl}/auth/customer`;
  private readonly http = inject(HttpClient);

  private readonly currentUserSignal = signal<CustomerProfile | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  /** Flips to `true` once the initial `me()` probe (see `bootstrap()`)
   * resolves either way — lets the header avoid flashing "Sign in" before
   * we actually know whether a session cookie is valid. */
  readonly ready = signal(false);

  /** Seeds the double-submit CSRF cookie — call before any state-changing
   * request if one hasn't been issued yet this session (a cookie from a
   * previous visit may already be valid; `credentials.interceptor.ts` sends
   * whatever's currently in `document.cookie` regardless of when it was
   * set, so this is only needed the very first time). */
  primeCsrf(): Observable<ApiSuccess<{ status: string }>> {
    return this.http.get<ApiSuccess<{ status: string }>>(`${this.base}/csrf`).pipe(catchError((err) => rethrowApiError(err)));
  }

  /** Call once at app startup (see `app.config.ts`'s `APP_INITIALIZER`) to
   * silently resolve whether an existing session cookie is still valid,
   * without forcing every visitor through a login screen first. */
  bootstrap(): Observable<CustomerProfile | null> {
    return this.me().pipe(
      map((profile) => profile),
      catchError(() => {
        this.currentUserSignal.set(null);
        return [null];
      }),
      tap(() => this.ready.set(true)),
    );
  }

  /** A fresh server-verified captcha. Each one allows a single attempt. */
  getCaptcha(): Observable<CaptchaChallenge> {
    return this.http.get<ApiSuccess<CaptchaChallenge>>(`${this.base}/captcha`).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Sends a code to any valid number (also used for "Resend"). Needs a
   * solved captcha every time, which the server consumes either way. */
  requestOtp(mobileNumber: string, captcha: CaptchaAnswer): Observable<RequestOtpResponse> {
    const body = { mobileNumber, captchaId: captcha.captchaId, captchaAnswer: captcha.answer };
    return this.http.post<ApiSuccess<RequestOtpResponse>>(`${this.base}/otp/request`, body).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Signs in when the number has an account; otherwise returns the
   * `name_required` step and leaves `currentUser` untouched. */
  verifyOtp(payload: VerifyOtpRequest): Observable<VerifyOtpResponse> {
    return this.http.post<ApiSuccess<VerifyOtpResponse>>(`${this.base}/otp/verify`, payload).pipe(
      tap((res) => {
        if (res.data.status === 'authenticated') this.currentUserSignal.set(res.data.customer);
      }),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Creates the account for a verified new number and signs in. */
  completeSignup(payload: CompleteSignupRequest): Observable<CustomerProfile> {
    return this.http.post<ApiSuccess<CompleteSignupResponse>>(`${this.base}/signup/complete`, payload).pipe(
      tap((res) => this.currentUserSignal.set(res.data.customer)),
      map((res) => res.data.customer),
      catchError((err) => rethrowApiError(err)),
    );
  }

  logout(): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/logout`, {}).pipe(
      tap(() => this.currentUserSignal.set(null)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** `POST /auth/customer/refresh` — rotates the access-token cookie (and
   * the CSRF cookie alongside it) using the long-lived refresh-token
   * cookie, without a full re-login. Consumed by `auth-refresh.interceptor.ts`
   * on a 401 `UNAUTHENTICATED` response; not something a component calls
   * directly. Doesn't touch `currentUserSignal` — a successful refresh
   * doesn't change who's logged in, only how much longer their session
   * cookie is valid for. */
  refresh(): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/refresh`, {}).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  me(): Observable<CustomerProfile> {
    return this.http.get<ApiSuccess<CustomerProfile>>(`${this.base}/me`).pipe(
      tap((res) => this.currentUserSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Drops the in-memory profile without hitting the backend — for a 401
   * caught elsewhere (e.g. an authenticated call failing because the
   * session already expired server-side), where calling `logout()` would
   * just 401 again. */
  clearLocalSession(): void {
    this.currentUserSignal.set(null);
  }
}
