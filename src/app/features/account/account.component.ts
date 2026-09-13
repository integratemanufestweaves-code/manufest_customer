import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { Address, AddressRequest } from '../../core/models/customer.models';

type AccountTab = 'profile' | 'addresses';

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
  imports: [FormsModule, RouterLink],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);

  readonly profile = this.auth.currentUser;
  readonly cartItemCount = this.cartService.itemCount;
  readonly wishlistItemCount = this.wishlistService.itemCount;

  readonly tab = signal<AccountTab>('profile');

  // -- profile tab --
  firstName = '';
  lastName = '';
  dob = '';
  phone = '';
  readonly profileSaving = signal(false);
  readonly profileSaved = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly photoUploading = signal(false);
  readonly photoWarning = signal<string | null>(null);

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
    const p = this.profile();
    if (p) {
      // `first_name`/`last_name` are only ever set via this form's own
      // PATCH /profile — registration (email or mobile) only ever writes
      // `full_name` (see auth.api.js's /register, /register/mobile). So a
      // customer who registered but never touched this form sees a blank
      // form on every visit despite already having a name on file. Fall
      // back to splitting `fullName` so the fields start populated instead
      // of empty — still editable, and saving writes firstName/lastName
      // back explicitly either way.
      if (p.firstName || p.lastName) {
        this.firstName = p.firstName || '';
        this.lastName = p.lastName || '';
      } else if (p.fullName) {
        const [first, ...rest] = p.fullName.trim().split(/\s+/);
        this.firstName = first || '';
        this.lastName = rest.join(' ');
      }
      this.phone = p.phone || '';
      // `dob` comes back from mysql2 as a full ISO datetime (pool.js has
      // `dateStrings: false`), e.g. "2026-01-01T00:00:00.000Z" — an
      // `<input type="date">` only accepts the bare `YYYY-MM-DD` portion.
      this.dob = p.dob ? p.dob.slice(0, 10) : '';
    }
    this.loadAddresses();
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
    if (!this.firstName || !this.lastName) {
      this.profileError.set('First and last name are required.');
      return;
    }
    this.profileError.set(null);
    this.profileSaving.set(true);
    this.profileSaved.set(false);
    const fullName = `${this.firstName} ${this.lastName}`.trim();
    this.customerService.updateProfile({ fullName, firstName: this.firstName, lastName: this.lastName, phone: this.phone || undefined, dob: this.dob || undefined }).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileSaved.set(true);
        this.auth.me().subscribe();
      },
      error: (err) => {
        this.profileError.set(err?.message || 'Could not save your profile.');
        this.profileSaving.set(false);
      },
    });
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
