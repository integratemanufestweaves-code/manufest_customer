/**
 * Shapes for manufest_be's `auth` module (`src/modules/auth/auth.api.js`,
 * mounted `/api/v1/auth/customer`) — see that file directly (not just the
 * knowledge-base summary) for the exact field names below; this app's own
 * `api.models.ts` already defines the shared `ApiSuccess`/`ApiError`
 * envelope this module reuses.
 *
 * One mobile-OTP flow covers both sign-in and sign-up:
 * `POST /otp/request` → `POST /otp/verify` → (new numbers only)
 * `POST /signup/complete`. The request step answers identically whether or
 * not the number has an account; only a correct code reveals which case it
 * is. There are no email+password shapes here because those backend routes
 * no longer exist.
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

/** `GET /captcha` — a server-drawn image; the answer never reaches the
 * browser and is checked (once) by `POST /otp/request`. */
export interface CaptchaChallenge {
  captchaId: string;
  /** `data:image/svg+xml;base64,...` — for an `<img>`, never inlined. */
  image: string;
  expiresInSeconds: number;
}

/** What the captcha component hands its host form once something is typed. */
export interface CaptchaAnswer {
  captchaId: string;
  answer: string;
}

/** `POST /otp/request` — the same shape for every number. `challengeId` is
 * an opaque handle for this one code; a resend returns a new one and the
 * old code stops working. */
export interface RequestOtpResponse {
  challengeId: string;
  maskedMobileNumber: string;
  expiresInSeconds: number;
  /** Server-side per-number cooldown before another code can be sent. */
  resendAfterSeconds: number;
}

export interface VerifyOtpRequest {
  challengeId: string;
  code: string;
}

/** `POST /otp/verify` with the right code: an existing account is signed in
 * (session cookies set); a new number gets a short-lived, single-use
 * `signupToken` for the name step instead (no session yet, no account). */
export type VerifyOtpResponse =
  | { status: 'authenticated'; customer: CustomerProfile }
  | { status: 'name_required'; signupToken: string; expiresInSeconds: number; maskedMobileNumber: string };

export interface CompleteSignupRequest {
  signupToken: string;
  fullName: string;
}

export interface CompleteSignupResponse {
  status: 'authenticated';
  customer: CustomerProfile;
}
