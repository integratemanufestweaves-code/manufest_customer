import { Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

import { CaptchaAnswer } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { CaptchaComponent } from '../../../shared/captcha/captcha.component';
import { OtpInputComponent } from '../../../shared/otp-input/otp-input.component';
import { OtpTimerComponent } from '../../../shared/otp-timer/otp-timer.component';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { ConsentService } from '../../../core/services/consent.service';

type Step = 'enter-number' | 'enter-code' | 'enter-name';

/** Mirrors manufest_be's auth.validation.js (customerMobileNumberSchema /
 * completeCustomerSignup.fullName) so mistakes show before a round trip.
 * The server re-checks both regardless. */
const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

/** Backend codes after which the only way forward is a fresh code. */
const RESTART_CODES = new Set(['SIGNUP_TOKEN_INVALID', 'SIGNUP_CONFLICT']);

/**
 * The only customer sign-in AND sign-up screen (`/register` redirects here).
 * One flow for every number, matching manufest_be's auth.api.js:
 *
 *   1. enter-number: number + server-verified captcha, then sends a code.
 *      The backend answers the same way whether or not the number has an
 *      account, so this screen never says which. "Resend code" comes back
 *      here too (new captcha every send).
 *   2. enter-code: a correct code signs an existing customer straight in.
 *      For a new number the backend returns a short-lived signup token
 *      instead, and no account exists yet.
 *   3. enter-name (new numbers only): a name is required and can't be
 *      skipped; the account is only created when it's submitted.
 *
 * The signup token lives only in this component's memory, never in
 * storage, so leaving the page abandons the sign-up cleanly.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, OtpInputComponent, OtpTimerComponent, CaptchaComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly consent = inject(ConsentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Present only on the enter-number step. */
  @ViewChild(CaptchaComponent) private captchaComponent?: CaptchaComponent;

  readonly step = signal<Step>('enter-number');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  /** Neutral guidance (not an error), e.g. why the captcha is back. */
  readonly notice = signal<string | null>(null);
  readonly captcha = signal<CaptchaAnswer | null>(null);

  mobileNumber = '';
  otpCode = '';
  fullName = '';
  /** Required: Terms of Use + Privacy Policy. Recorded server-side once
   * signed in (ConsentService), together with the optional offers opt-in. */
  acceptTerms = false;
  marketingOptIn = false;
  private challengeId: string | null = null;
  private signupToken: string | null = null;
  readonly maskedMobile = signal<string | null>(null);
  /** How long the current code is valid for, as issued — the countdown
   * itself lives in `app-otp-timer`. `otpIssuedAt` changes on every send so
   * a resend with the same duration still restarts that countdown. */
  readonly otpExpiresIn = signal<number | null>(null);
  readonly otpIssuedAt = signal<number | null>(null);
  /** Seconds left before "Resend code" becomes clickable again. */
  readonly resendCountdown = signal(0);
  private otpTimerHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    // Set by `auth-refresh.interceptor.ts` when a session dies for real
    // (refresh token itself missing/expired/revoked) and it force-navigates
    // here. Without this, a customer mid-checkout who got silently bounced
    // sees a bare, unexplained sign-in form and no idea why they're here.
    if (this.route.snapshot.queryParamMap.get('sessionExpired') === '1') {
      this.error.set('Your session has expired. Please sign in again to continue.');
    }
  }

  ngOnDestroy(): void {
    this.clearOtpTimer();
  }

  private clearOtpTimer(): void {
    if (this.otpTimerHandle !== null) {
      clearInterval(this.otpTimerHandle);
      this.otpTimerHandle = null;
    }
  }

  private startOtpTimer(expiresInSeconds: number, resendAfterSeconds: number): void {
    this.clearOtpTimer();
    this.otpExpiresIn.set(expiresInSeconds);
    this.otpIssuedAt.set(Date.now());
    this.resendCountdown.set(resendAfterSeconds);
    if (resendAfterSeconds <= 0) return;
    this.otpTimerHandle = setInterval(() => {
      const resend = this.resendCountdown() - 1;
      this.resendCountdown.set(Math.max(0, resend));
      if (resend <= 0) this.clearOtpTimer();
    }, 1000);
  }

  private redirectAfterSignIn(source: 'login' | 'signup'): void {
    this.signupToken = null;
    // Fire and forget: a failed consent write never blocks sign-in.
    this.consent.recordAccountConsents(this.marketingOptIn, source).subscribe();
    // A cookie choice made as a guest goes on the customer's record too.
    this.consent.syncCookiePreferences('cookie_banner').subscribe();
    this.cart.refresh();
    this.wishlist.refresh();
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    this.router.navigateByUrl(redirectTo || '/');
  }

  /** Back to step 1 (number kept, fresh captcha), dropping every piece of
   * in-flight state. */
  private restart(message: string | null, notice: string | null = null): void {
    this.clearOtpTimer();
    this.challengeId = null;
    this.signupToken = null;
    this.otpCode = '';
    this.fullName = '';
    this.captcha.set(null);
    this.submitting.set(false);
    this.step.set('enter-number');
    this.error.set(message);
    this.notice.set(notice);
  }

  onMobileInput(value: string): void {
    this.mobileNumber = value.replace(/\D/g, '').slice(0, 10);
  }

  requestOtp(): void {
    if (!MOBILE_PATTERN.test(this.mobileNumber)) {
      this.error.set('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!this.acceptTerms) {
      this.error.set('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }
    const captcha = this.captcha();
    if (!captcha) {
      this.error.set('Type the characters shown in the image.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.requestOtp(this.mobileNumber, captcha).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.notice.set(null);
        this.challengeId = res.challengeId;
        this.maskedMobile.set(res.maskedMobileNumber);
        this.otpCode = '';
        this.startOtpTimer(res.expiresInSeconds, res.resendAfterSeconds);
        this.step.set('enter-code');
      },
      error: (err) => {
        // The server consumed that captcha whatever went wrong. Always
        // continue with a fresh one.
        this.captchaComponent?.refresh();
        this.error.set(err?.message || 'Could not send a code right now. Please try again.');
        this.submitting.set(false);
      },
    });
  }

  verifyOtp(): void {
    if (!this.challengeId) {
      this.restart('That code has expired. Request a new one.');
      return;
    }
    if (!/^[0-9]{6}$/.test(this.otpCode)) {
      this.error.set('Enter the 6-digit code we sent you.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.verifyOtp({ challengeId: this.challengeId, code: this.otpCode }).subscribe({
      next: (res) => {
        if (res.status === 'authenticated') {
          this.redirectAfterSignIn('login');
          return;
        }
        this.clearOtpTimer();
        this.challengeId = null;
        this.signupToken = res.signupToken;
        this.submitting.set(false);
        this.step.set('enter-name');
        // Same focus hand-off as account.component's focusMobileField: the
        // field only exists once the new step has rendered.
        setTimeout(() => document.getElementById('signupFullName')?.focus());
      },
      error: (err) => {
        this.otpCode = '';
        this.error.set(err?.message || 'That code is invalid or has expired.');
        this.submitting.set(false);
      },
    });
  }

  completeSignup(): void {
    if (!this.signupToken) {
      this.restart('Please verify your mobile number again.');
      return;
    }
    const name = this.fullName.trim();
    if (name.length < 2) {
      this.error.set('Enter your full name.');
      return;
    }
    if (name.length > 150 || !NAME_PATTERN.test(name)) {
      this.error.set("Use letters, spaces and . ' - only in your name.");
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.completeSignup({ signupToken: this.signupToken, fullName: name }).subscribe({
      next: () => this.redirectAfterSignIn('signup'),
      error: (err) => {
        if (RESTART_CODES.has(err?.code)) {
          this.restart(err?.message || 'Please verify your mobile number again.');
          return;
        }
        this.error.set(err?.message || 'Could not create your account. Please try again.');
        this.submitting.set(false);
      },
    });
  }

  /** Every send needs a solved captcha, so a resend goes back to step 1
   * with the number already filled in. */
  resendOtp(): void {
    if (this.resendCountdown() > 0) return;
    this.restart(null, 'Enter the characters in the image to get a new code.');
  }

  useDifferentNumber(): void {
    this.restart(null);
  }
}
