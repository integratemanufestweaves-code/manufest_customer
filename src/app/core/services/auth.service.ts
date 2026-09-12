import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import {
  ChangePasswordRequest,
  CustomerProfile,
  LoginRequest,
  RegisterMobileRequest,
  RegisterMobileResponse,
  RegisterRequest,
  RequestLoginOtpRequest,
  RequestLoginOtpResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  VerifyOtpRequest,
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
 * `register`/`login`'s own success response is a narrower shape than
 * `GET /me` — every method that establishes a session below chains into
 * `me()` afterward so `currentUser` always ends up fully populated from
 * one canonical source, rather than juggling two response shapes in
 * component code.
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

  registerEmail(payload: RegisterRequest): Observable<CustomerProfile> {
    return this.http.post<ApiSuccess<{ id: string; email: string; fullName: string }>>(`${this.base}/register`, payload).pipe(
      switchMap(() => this.me()),
      catchError((err) => rethrowApiError(err)),
    );
  }

  loginEmail(payload: LoginRequest): Observable<CustomerProfile> {
    return this.http.post<ApiSuccess<{ id: string; email: string; fullName: string }>>(`${this.base}/login`, payload).pipe(
      switchMap(() => this.me()),
      catchError((err) => rethrowApiError(err)),
    );
  }

  registerMobile(payload: RegisterMobileRequest): Observable<RegisterMobileResponse> {
    return this.http.post<ApiSuccess<RegisterMobileResponse>>(`${this.base}/register/mobile`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  verifyRegisterMobileOtp(payload: VerifyOtpRequest): Observable<CustomerProfile> {
    return this.http.post<ApiSuccess<CustomerProfile>>(`${this.base}/register/mobile/verify-otp`, payload).pipe(
      tap((res) => this.currentUserSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  requestLoginOtp(payload: RequestLoginOtpRequest): Observable<RequestLoginOtpResponse> {
    return this.http.post<ApiSuccess<RequestLoginOtpResponse>>(`${this.base}/login/otp/request`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  verifyLoginOtp(payload: VerifyOtpRequest): Observable<CustomerProfile> {
    return this.http.post<ApiSuccess<CustomerProfile>>(`${this.base}/login/otp/verify`, payload).pipe(
      tap((res) => this.currentUserSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  resendOtp(payload: ResendOtpRequest): Observable<ResendOtpResponse> {
    return this.http.post<ApiSuccess<ResendOtpResponse>>(`${this.base}/otp/resend`, payload).pipe(
      map((res) => res.data),
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

  me(): Observable<CustomerProfile> {
    return this.http.get<ApiSuccess<CustomerProfile>>(`${this.base}/me`).pipe(
      tap((res) => this.currentUserSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  changePassword(payload: ChangePasswordRequest): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/password/change`, payload).pipe(
      tap(() => this.currentUserSignal.set(null)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  requestPasswordReset(email: string): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/password/reset/request`, { email }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<{ status: string }> {
    return this.http.post<ApiSuccess<{ status: string }>>(`${this.base}/password/reset/confirm`, { token, newPassword }).pipe(
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
