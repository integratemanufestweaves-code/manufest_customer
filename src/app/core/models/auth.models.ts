/**
 * Shapes for manufest_be's `auth` module (`src/modules/auth/auth.api.js`,
 * mounted `/api/v1/auth/customer`) — see that file directly (not just the
 * knowledge-base summary) for the exact field names below; this app's own
 * `api.models.ts` already defines the shared `ApiSuccess`/`ApiError`
 * envelope this module reuses.
 *
 * Two parallel login/register paths exist (email+password and mobile+OTP),
 * neither replacing the other — see 0042_alter_customers_for_dual_auth.sql.
 * `register`/`login`'s own success response is a narrower `{id, email,
 * fullName}` than `GET /me`'s full `toPublicCustomer()` shape; `AuthService`
 * always calls `me()` right after any successful auth action so the
 * frontend has one consistent, fully-populated `CustomerProfile` in state
 * rather than juggling two response shapes.
 */

export interface CustomerProfile {
  /** `toPublicCustomer()` names this `id` but it is the customer's `uuid`,
   * never the numeric DB id — never exposed to this app. */
  id: string;
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mobileNumber: string | null;
  status: string;
  /** Raw, private storage URL from `users.api.js`'s `PATCH /profile/photo`
   * (a generic `storageAdapter`, not the products-media bucket) — unlike
   * product media this is directly loadable as an `<img>` src, no
   * `ProductService.mediaSrc()` proxy needed (see that route's own header
   * comment on why this bucket is public-read). `null` until a photo's
   * been uploaded. */
  profileImage: string | null;
  /** ISO date string (`YYYY-MM-DD`), `null` until set via `PATCH /profile`. */
  dob: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterMobileRequest {
  mobileNumber: string;
  fullName?: string;
}

export interface RegisterMobileResponse {
  customerUuid: string;
  maskedMobileNumber: string;
  otpId: number;
  expiresInSeconds: number;
  isNewRegistration: boolean;
}

export interface VerifyOtpRequest {
  customerUuid: string;
  code: string;
}

export interface RequestLoginOtpRequest {
  mobileNumber: string;
}

/** Deliberately vague on failure (no `customerUuid` etc.) so this can't be
 * used to enumerate accounts — see auth.api.js's own comment. */
export interface RequestLoginOtpResponse {
  acknowledged: true;
  customerUuid?: string;
  maskedMobileNumber?: string;
  otpId?: number;
  expiresInSeconds?: number;
}

export type OtpPurpose = 'MOBILE_VERIFICATION' | 'LOGIN';

export interface ResendOtpRequest {
  customerUuid: string;
  purpose: OtpPurpose;
}

export interface ResendOtpResponse {
  customerUuid: string;
  otpId: number;
  expiresInSeconds: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
