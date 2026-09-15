import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';

type LoginMethod = 'email' | 'mobile';
type MobileStep = 'enter-number' | 'enter-code';

/**
 * `ui_design/Login Page.png` shows an identifier-first modal (type an
 * email/mobile, the app silently decides sign-in vs. create-account,
 * offers a Passkey option). Backend reality: two genuinely separate flows
 * (email+password, mobile+OTP) and no such "detect new vs. existing"
 * endpoint at all — see auth.api.js directly. Built as an explicit method
 * toggle instead (tabs, not silent detection) so every state is reachable
 * without guessing what a not-really-existing endpoint would return, and
 * as a full page rather than a modal — this app has no global overlay/
 * portal infrastructure yet, and building one just for this one flow
 * wasn't worth the added surface area for a first pass. Passkey/WebAuthn
 * is dropped entirely: no such concept exists anywhere in manufest_be.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly method = signal<LoginMethod>('email');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Set by `auth-refresh.interceptor.ts` when a session dies for real
    // (refresh token itself missing/expired/revoked) and it force-navigates
    // here — without this, a customer mid-checkout who got silently bounced
    // sees a bare, unexplained login form and no idea why they're here.
    if (this.route.snapshot.queryParamMap.get('sessionExpired') === '1') {
      this.error.set('Your session has expired. Please log in again to continue.');
    }
  }

  // -- email + password --
  email = '';
  password = '';
  readonly showForgotPassword = signal(false);
  readonly forgotEmail = signal('');
  readonly forgotSubmitting = signal(false);
  readonly forgotDone = signal(false);

  // -- mobile + OTP --
  readonly mobileStep = signal<MobileStep>('enter-number');
  mobileNumber = '';
  otpCode = '';
  private customerUuid: string | null = null;
  readonly maskedMobile = signal<string | null>(null);
  readonly otpExpiresIn = signal<number | null>(null);

  setMethod(method: LoginMethod): void {
    this.method.set(method);
    this.error.set(null);
  }

  private redirectAfterLogin(): void {
    this.cart.refresh();
    this.wishlist.refresh();
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    this.router.navigateByUrl(redirectTo || '/');
  }

  submitEmailLogin(): void {
    if (!this.email || !this.password) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.loginEmail({ email: this.email, password: this.password }).subscribe({
      next: () => this.redirectAfterLogin(),
      error: (err) => {
        this.error.set(err?.message || 'Could not sign in — check your details and try again.');
        this.submitting.set(false);
      },
    });
  }

  submitForgotPassword(): void {
    if (!this.forgotEmail()) return;
    this.forgotSubmitting.set(true);
    this.auth.requestPasswordReset(this.forgotEmail()).subscribe({
      next: () => {
        this.forgotSubmitting.set(false);
        this.forgotDone.set(true);
      },
      error: () => {
        // Backend always responds success here regardless of whether the
        // account exists (no email enumeration) — a network-level failure
        // is the only way this branch fires.
        this.forgotSubmitting.set(false);
        this.forgotDone.set(true);
      },
    });
  }

  requestMobileOtp(): void {
    if (!/^[0-9]{10}$/.test(this.mobileNumber)) {
      this.error.set('Enter a valid 10-digit mobile number.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.requestLoginOtp({ mobileNumber: this.mobileNumber }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        // Deliberately generic on the backend (no account-existence
        // signal) — always advance to the code step; an unregistered
        // number just never receives an SMS, verify-otp then fails with a
        // clean "invalid or expired code" instead of leaking anything here.
        this.customerUuid = res.customerUuid ?? null;
        this.maskedMobile.set(res.maskedMobileNumber ?? null);
        this.otpExpiresIn.set(res.expiresInSeconds ?? null);
        this.mobileStep.set('enter-code');
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not send a code right now.');
        this.submitting.set(false);
      },
    });
  }

  verifyMobileOtp(): void {
    if (!this.customerUuid) {
      this.error.set('That code has expired — request a new one.');
      this.mobileStep.set('enter-number');
      return;
    }
    if (!this.otpCode) {
      this.error.set('Enter the code we sent you.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.verifyLoginOtp({ customerUuid: this.customerUuid, code: this.otpCode }).subscribe({
      next: () => this.redirectAfterLogin(),
      error: (err) => {
        this.error.set(err?.message || 'That code is invalid or expired.');
        this.submitting.set(false);
      },
    });
  }

  backToMobileNumber(): void {
    this.mobileStep.set('enter-number');
    this.otpCode = '';
    this.error.set(null);
  }
}
