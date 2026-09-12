import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';

type RegisterMethod = 'email' | 'mobile';
type MobileStep = 'enter-details' | 'enter-code';

/** Same method-toggle approach as `LoginComponent` — see that file's header
 * comment for why this isn't the design's identifier-first modal. */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);

  readonly method = signal<RegisterMethod>('email');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // -- email + password --
  fullName = '';
  email = '';
  password = '';

  /** Mirrors `passwordSchema` in manufest_be's `auth.validation.js` exactly
   * (min 10, needs lower+upper+digit) — checked client-side so a customer
   * finds out before submitting, not just from the server's 422. */
  readonly passwordIssues = computed(() => {
    const p = this.password;
    const issues: string[] = [];
    if (p.length > 0 && p.length < 10) issues.push('at least 10 characters');
    if (p.length > 0 && !/[a-z]/.test(p)) issues.push('a lowercase letter');
    if (p.length > 0 && !/[A-Z]/.test(p)) issues.push('an uppercase letter');
    if (p.length > 0 && !/[0-9]/.test(p)) issues.push('a digit');
    return issues;
  });

  // -- mobile + OTP --
  readonly mobileStep = signal<MobileStep>('enter-details');
  mobileFullName = '';
  mobileNumber = '';
  otpCode = '';
  private customerUuid: string | null = null;
  readonly maskedMobile = signal<string | null>(null);
  readonly otpExpiresIn = signal<number | null>(null);

  setMethod(method: RegisterMethod): void {
    this.method.set(method);
    this.error.set(null);
  }

  private redirectAfterAuth(): void {
    this.cart.refresh();
    this.wishlist.refresh();
    this.router.navigateByUrl('/');
  }

  submitEmailRegister(): void {
    if (!this.fullName || !this.email || !this.password) {
      this.error.set('Fill in your name, email, and password.');
      return;
    }
    if (this.passwordIssues().length > 0) {
      this.error.set('Password needs ' + this.passwordIssues().join(', ') + '.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.registerEmail({ fullName: this.fullName, email: this.email, password: this.password }).subscribe({
      next: () => this.redirectAfterAuth(),
      error: (err) => {
        this.error.set(err?.message || 'Could not create your account.');
        this.submitting.set(false);
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
    this.auth.registerMobile({ mobileNumber: this.mobileNumber, fullName: this.mobileFullName || undefined }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.customerUuid = res.customerUuid;
        this.maskedMobile.set(res.maskedMobileNumber);
        this.otpExpiresIn.set(res.expiresInSeconds);
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
      this.mobileStep.set('enter-details');
      return;
    }
    if (!this.otpCode) {
      this.error.set('Enter the code we sent you.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.verifyRegisterMobileOtp({ customerUuid: this.customerUuid, code: this.otpCode }).subscribe({
      next: () => this.redirectAfterAuth(),
      error: (err) => {
        this.error.set(err?.message || 'That code is invalid or expired.');
        this.submitting.set(false);
      },
    });
  }

  backToMobileDetails(): void {
    this.mobileStep.set('enter-details');
    this.otpCode = '';
    this.error.set(null);
  }
}
