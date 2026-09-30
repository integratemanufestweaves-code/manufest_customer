import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { Address, AddressRequest } from '../../core/models/customer.models';
import { OtpInputComponent } from '../../shared/otp-input/otp-input.component';

type AccountTab = 'profile' | 'addresses';
/** `view` = read-only summary, `edit` = the form, `verify-mobile` = entering
 * the code sent to a newly entered mobile number after saving the form. */
type ProfileMode = 'view' | 'edit' | 'verify-mobile';

/**
 * `ui_design/Profile - Account.png` shows four tabs: Profile | Manage
 * Address | Manage Payment details | Purchase and Reviews. Only the first
 * two are backed — "Manage Payment details" has no saved-card/UPI storage
 * anywhere in manufest_be (the only adjacent table, `customer_accounts`,
 * is refund payout details, a different thing), and "Purchase and
 * Reviews" needs a reviews module that doesn't exist at all. See
 * `CUSTOMER_APP_TODO.md`'s §4c/§4d — both tabs are left out here rather
 * than built against nothing.
 */
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, OtpInputComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);

  readonly profile = this.auth.currentUser;
  readonly cartItemCount = this.cartService.itemCount;
  readonly wishlistItemCount = this.wishlistService.itemCount;

  readonly tab = signal<AccountTab>('profile');

  // -- profile tab --
  readonly profileMode = signal<ProfileMode>('view');
  firstName = '';
  lastName = '';
  dob = '';
  mobileNumber = '';
  readonly mobileError = signal<string | null>(null);
  readonly profileSaving = signal(false);
  readonly profileSaved = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly photoUploading = signal(false);
  readonly photoWarning = signal<string | null>(null);

  // -- mobile number verification (profile tab) --
  otpCode = '';
  readonly otpMaskedMobile = signal<string | null>(null);
  readonly otpExpiresIn = signal<number | null>(null);
  readonly resendCountdown = signal(0);
  readonly resending = signal(false);
  readonly verifying = signal(false);
  private static readonly RESEND_DELAY_SECONDS = 20;
  private otpTimerHandle: ReturnType<typeof setInterval> | null = null;

  // -- addresses tab --
  readonly addresses = signal<Address[]>([]);
  readonly addressesLoading = signal(true);
  readonly addressesError = signal<string | null>(null);
  /** `null` = list view, `'new'` = blank form, an `Address` = editing that row. */
  readonly editingAddress = signal<Address | 'new' | null>(null);
  addressForm: AddressRequest = this.blankAddressForm();
  readonly addressSaving = signal(false);
  readonly addressFormError = signal<string | null>(null);

  ngOnInit(): void {
    this.resetProfileForm();
    this.loadAddresses();
  }

  ngOnDestroy(): void {
    this.clearOtpTimer();
  }

  /** Fills the edit form from the current profile — on load, and again on
   * every "Edit" / "Cancel" so an abandoned edit never lingers. */
  private resetProfileForm(): void {
    const p = this.profile();
    if (!p) return;
    // `first_name`/`last_name` are only ever set via this form's own
    // PATCH /profile — sign-up only ever writes `full_name` (see
    // auth.api.js's /signup/complete). So a
    // customer who registered but never touched this form would see blank
    // name fields. Fall back to splitting `fullName` so they start populated.
    if (p.firstName || p.lastName) {
      this.firstName = p.firstName || '';
      this.lastName = p.lastName || '';
    } else if (p.fullName) {
      const [first, ...rest] = p.fullName.trim().split(/\s+/);
      this.firstName = first || '';
      this.lastName = rest.join(' ');
    } else {
      this.firstName = '';
      this.lastName = '';
    }
    // `phone` is the old free-text field this form used to write (never
    // verified, so OTP login ignores it). Pre-fill from it for customers who
    // entered a number that way, so saving walks them through verification.
    const legacyPhone = (p.phone || '').replace(/\D/g, '');
    this.mobileNumber = p.mobileNumber || (legacyPhone.length === 10 ? legacyPhone : '');
    // `dob` comes back from mysql2 as a full ISO datetime (pool.js has
    // `dateStrings: false`), e.g. "2026-01-01T00:00:00.000Z" — an
    // `<input type="date">` only accepts the bare `YYYY-MM-DD` portion.
    this.dob = p.dob ? p.dob.slice(0, 10) : '';
    this.mobileError.set(null);
    this.profileError.set(null);
  }

  startEditProfile(): void {
    this.resetProfileForm();
    this.profileSaved.set(null);
    this.profileMode.set('edit');
  }

  cancelEditProfile(): void {
    this.resetProfileForm();
    this.profileMode.set('view');
  }

  /** Digits only, max 10 — strips anything else as it's typed or pasted. */
  onMobileInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, 10);
    el.value = digits;
    this.mobileNumber = digits;
    this.mobileError.set(null);
  }

  private focusMobileField(): void {
    setTimeout(() => document.getElementById('profileMobile')?.focus());
  }

  setTab(tab: AccountTab): void {
    this.tab.set(tab);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.cartService.clearLocalState();
        this.wishlistService.clearLocalState();
        window.location.href = '/';
      },
    });
  }

  saveProfile(): void {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.profileError.set('First and last name are required.');
      return;
    }
    const currentMobile = this.profile()?.mobileNumber || '';
    if (this.mobileNumber && !/^[0-9]{10}$/.test(this.mobileNumber)) {
      this.mobileError.set('Enter a valid 10-digit mobile number.');
      this.focusMobileField();
      return;
    }
    if (!this.mobileNumber && currentMobile) {
      this.mobileError.set('Your mobile number can be changed but not removed.');
      this.focusMobileField();
      return;
    }
    const mobileChanged = !!this.mobileNumber && this.mobileNumber !== currentMobile;

    this.profileError.set(null);
    this.mobileError.set(null);
    this.profileSaving.set(true);
    this.profileSaved.set(null);
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const fullName = `${firstName} ${lastName}`;
    this.customerService.updateProfile({ fullName, firstName, lastName, dob: this.dob || undefined }).subscribe({
      next: () => {
        this.auth.me().subscribe();
        if (!mobileChanged) {
          this.profileSaving.set(false);
          this.profileSaved.set('Profile updated.');
          this.profileMode.set('view');
          return;
        }
        this.sendMobileOtp();
      },
      error: (err) => {
        this.profileError.set(err?.message || 'Could not save your profile.');
        this.profileSaving.set(false);
      },
    });
  }

  /** Name/dob are already saved by this point — only the number is pending. */
  private sendMobileOtp(): void {
    this.customerService.requestMobileOtp(this.mobileNumber).subscribe({
      next: (res) => {
        this.profileSaving.set(false);
        this.otpCode = '';
        this.otpMaskedMobile.set(res.maskedMobileNumber);
        this.startOtpTimer(res.expiresInSeconds);
        this.profileMode.set('verify-mobile');
      },
      error: (err) => {
        this.profileSaving.set(false);
        this.mobileError.set(err?.message || 'Could not send a code to that number right now.');
        this.focusMobileField();
      },
    });
  }

  verifyMobile(): void {
    if (!/^[0-9]{6}$/.test(this.otpCode)) {
      this.profileError.set('Enter the 6-digit code we sent you.');
      return;
    }
    this.profileError.set(null);
    this.verifying.set(true);
    this.customerService.verifyMobileOtp(this.mobileNumber, this.otpCode).subscribe({
      next: () => {
        this.verifying.set(false);
        this.clearOtpTimer();
        this.auth.me().subscribe(() => this.resetProfileForm());
        this.profileSaved.set('Mobile number verified. You can now sign in with OTP.');
        this.profileMode.set('view');
      },
      error: (err) => {
        this.verifying.set(false);
        this.otpCode = '';
        this.profileError.set(err?.message || 'That code is invalid or expired.');
      },
    });
  }

  resendMobileOtp(): void {
    if (this.resendCountdown() > 0 || this.resending()) return;
    this.profileError.set(null);
    this.resending.set(true);
    this.customerService.requestMobileOtp(this.mobileNumber).subscribe({
      next: (res) => {
        this.resending.set(false);
        this.otpCode = '';
        this.startOtpTimer(res.expiresInSeconds);
      },
      error: (err) => {
        this.resending.set(false);
        this.profileError.set(err?.message || 'Could not resend the code right now.');
      },
    });
  }

  /** Back to the form with the new number still filled in, e.g. to fix a typo. */
  backToProfileForm(): void {
    this.clearOtpTimer();
    this.otpCode = '';
    this.profileError.set(null);
    this.profileMode.set('edit');
  }

  private clearOtpTimer(): void {
    if (this.otpTimerHandle !== null) {
      clearInterval(this.otpTimerHandle);
      this.otpTimerHandle = null;
    }
  }

  private startOtpTimer(expiresInSeconds: number | null): void {
    this.clearOtpTimer();
    this.otpExpiresIn.set(expiresInSeconds);
    this.resendCountdown.set(AccountComponent.RESEND_DELAY_SECONDS);
    this.otpTimerHandle = setInterval(() => {
      const expires = this.otpExpiresIn();
      if (expires !== null) this.otpExpiresIn.set(Math.max(0, expires - 1));
      const resend = this.resendCountdown();
      if (resend > 0) this.resendCountdown.set(resend - 1);
      if ((expires === null || expires <= 1) && resend <= 1) this.clearOtpTimer();
    }, 1000);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.photoWarning.set(null);
    this.photoUploading.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      this.customerService.updateProfilePhoto(base64, file.name, file.type).subscribe({
        next: (res) => {
          this.photoUploading.set(false);
          if (res.status === 'skipped') {
            this.photoWarning.set(res.warning || 'Photo upload is not available right now.');
          } else {
            this.auth.me().subscribe();
          }
        },
        error: (err) => {
          this.photoUploading.set(false);
          this.photoWarning.set(err?.message || 'Could not upload that photo.');
        },
      });
    };
    reader.readAsDataURL(file);
  }

  private loadAddresses(): void {
    this.addressesLoading.set(true);
    this.customerService.listAddresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        this.addressesLoading.set(false);
      },
      error: (err) => {
        this.addressesError.set(err?.message || 'Could not load your addresses.');
        this.addressesLoading.set(false);
      },
    });
  }

  private blankAddressForm(): AddressRequest {
    return { label: '', recipientName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: 'IN', isDefault: false };
  }

  startAddAddress(): void {
    this.addressForm = this.blankAddressForm();
    this.addressFormError.set(null);
    this.editingAddress.set('new');
  }

  startEditAddress(address: Address): void {
    this.addressForm = {
      label: address.label || '',
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      state: address.state || '',
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      isDefault: address.isDefault,
    };
    this.addressFormError.set(null);
    this.editingAddress.set(address);
  }

  cancelAddressForm(): void {
    this.editingAddress.set(null);
  }

  saveAddress(): void {
    const f = this.addressForm;
    if (!f.recipientName || !f.phone || !f.line1 || !f.city || !f.postalCode || f.countryCode.length !== 2) {
      this.addressFormError.set('Fill in recipient, phone, address line 1, city, postal code, and a 2-letter country code.');
      return;
    }
    this.addressFormError.set(null);
    this.addressSaving.set(true);

    const editing = this.editingAddress();
    const onSuccess = () => {
      this.addressSaving.set(false);
      this.editingAddress.set(null);
      this.loadAddresses();
    };
    const onError = (err: { message?: string }) => {
      this.addressFormError.set(err?.message || 'Could not save this address.');
      this.addressSaving.set(false);
    };

    if (editing && editing !== 'new') {
      this.customerService.updateAddress(editing.uuid, f).subscribe({ next: onSuccess, error: onError });
    } else {
      this.customerService.createAddress(f).subscribe({ next: onSuccess, error: onError });
    }
  }

  deleteAddress(address: Address): void {
    this.addressesError.set(null);
    this.customerService.deleteAddress(address.uuid).subscribe({
      next: () => this.loadAddresses(),
      error: (err) => this.addressesError.set(err?.message || 'Could not delete this address.'),
    });
  }
}
