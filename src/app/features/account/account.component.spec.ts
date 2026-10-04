import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountComponent } from './account.component';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerProfile } from '../../core/models/auth.models';
import { Address } from '../../core/models/customer.models';

function makeProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: 'cust-1',
    email: null,
    fullName: 'Sutha K',
    firstName: 'Sutha',
    lastName: 'K',
    phone: null,
    mobileNumber: '7871487161',
    status: 'ACTIVE',
    profileImage: null,
    dob: null,
    ...overrides,
  };
}

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    uuid: 'addr-1',
    label: 'Home',
    recipientName: 'Suthana',
    phone: '7871487161',
    line1: '10/20 B',
    line2: 'School st',
    city: 'Tenkasi',
    state: 'Tamilnadu',
    postalCode: '627808',
    countryCode: 'IN',
    isDefault: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AccountComponent', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let component: AccountComponent;
  let auth: AuthService;
  let customerService: CustomerService;

  function setup(profile: CustomerProfile, addresses: Address[] = []): void {
    TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    customerService = TestBed.inject(CustomerService);
    (auth as any).currentUserSignal.set(profile);
    spyOn(customerService, 'listAddresses').and.returnValue(of(addresses));
    spyOn(auth, 'me').and.returnValue(of(profile));
    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const sidebarLines = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.account-nav__email') as NodeListOf<HTMLElement>).map((el) => el.textContent!.trim());

  describe('sidebar contact lines', () => {
    it('shows only the mobile number when there is no email', () => {
      setup(makeProfile({ email: null }));
      expect(sidebarLines()).toEqual(['7871487161']);
    });

    it('shows both the mobile number and the email when both exist', () => {
      setup(makeProfile({ email: 'sutha@example.com' }));
      expect(sidebarLines()).toEqual(['7871487161', 'sutha@example.com']);
    });

    it('shows only the email when there is no mobile number', () => {
      setup(makeProfile({ mobileNumber: null, email: 'sutha@example.com' }));
      expect(sidebarLines()).toEqual(['sutha@example.com']);
    });
  });

  describe('editing the email', () => {
    it('pre-fills the form from the saved email', () => {
      setup(makeProfile({ email: 'old@example.com' }));
      component.startEditProfile();
      expect(component.email).toBe('old@example.com');
    });

    it('renders an Email input in the edit form', () => {
      setup(makeProfile());
      component.startEditProfile();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#profileEmail')).not.toBeNull();
    });

    it('rejects a malformed address without calling the API', () => {
      setup(makeProfile());
      const updateSpy = spyOn(customerService, 'updateProfile');
      component.startEditProfile();
      component.email = 'bad';
      component.saveProfile();
      expect(component.emailError()).toBe('Enter a valid email address.');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('sends a changed email trimmed and lower-cased', () => {
      setup(makeProfile({ email: null }));
      const updateSpy = spyOn(customerService, 'updateProfile').and.returnValue(of({ status: 'ok' }));
      component.startEditProfile();
      component.email = '  Sutha@Example.COM ';
      component.saveProfile();
      expect(updateSpy).toHaveBeenCalledWith(jasmine.objectContaining({ email: 'sutha@example.com' }));
    });

    it('does not send email when it is unchanged (keeps its verified status)', () => {
      setup(makeProfile({ email: 'same@example.com' }));
      const updateSpy = spyOn(customerService, 'updateProfile').and.returnValue(of({ status: 'ok' }));
      component.startEditProfile();
      component.email = 'SAME@example.com';
      component.saveProfile();
      expect(updateSpy.calls.mostRecent().args[0].email).toBeUndefined();
    });

    it('sends an empty string to clear a saved email', () => {
      setup(makeProfile({ email: 'old@example.com' }));
      const updateSpy = spyOn(customerService, 'updateProfile').and.returnValue(of({ status: 'ok' }));
      component.startEditProfile();
      component.email = '';
      component.saveProfile();
      expect(updateSpy).toHaveBeenCalledWith(jasmine.objectContaining({ email: '' }));
    });

    it('shows EMAIL_TAKEN under the email field, not as a general error', () => {
      setup(makeProfile());
      spyOn(customerService, 'updateProfile').and.returnValue(
        throwError(() => ({ code: 'EMAIL_TAKEN', message: 'This email address is already linked to another account.' })),
      );
      component.startEditProfile();
      component.email = 'taken@example.com';
      component.saveProfile();
      expect(component.emailError()).toBe('This email address is already linked to another account.');
      expect(component.profileError()).toBeNull();
      expect(component.profileSaving()).toBeFalse();
    });
  });

  describe('address country is fixed to India', () => {
    it('a new address starts with countryCode IN', () => {
      setup(makeProfile());
      component.startAddAddress();
      expect(component.addressForm.countryCode).toBe('IN');
    });

    it('editing an address with another (or no) country saves it as IN', () => {
      setup(makeProfile(), [makeAddress({ countryCode: 'US' })]);
      component.startEditAddress(makeAddress({ countryCode: 'US' }));
      expect(component.addressForm.countryCode).toBe('IN');
    });

    it('renders the Country field read-only, showing "India (IN)"', () => {
      setup(makeProfile());
      component.setTab('addresses');
      component.startAddAddress();
      fixture.detectChanges();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[name="countryCode"]');
      expect(input.readOnly).toBeTrue();
      expect(input.value).toBe('India (IN)');
    });
  });
});
