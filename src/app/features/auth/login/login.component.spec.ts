import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent — OTP auto-verify', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let auth: AuthService;

  const otpBoxes = () => Array.from(fixture.nativeElement.querySelectorAll('app-otp-input input')) as HTMLInputElement[];

  /** What an SMS autofill / paste does: the whole code lands in one box. */
  function autofill(code: string): void {
    const box = otpBoxes()[0];
    box.value = code;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    // Jump straight to the code step, as after a successful "Send code".
    (component as any).challengeId = 'challenge-1';
    component.step.set('enter-code');
    fixture.detectChanges();
    // ngModel inside a <form> hooks up to its control a tick after the
    // first render — wait for that before typing into the boxes.
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('verifies as soon as an autofilled 6-digit code lands, without tapping Verify', () => {
    const verifySpy = spyOn(auth, 'verifyOtp').and.returnValue(NEVER);

    autofill('123456');

    expect(verifySpy).toHaveBeenCalledOnceWith({ challengeId: 'challenge-1', code: '123456' });
    expect(component.submitting()).toBeTrue();
  });

  it('does not verify a partial autofill', () => {
    const verifySpy = spyOn(auth, 'verifyOtp');
    autofill('123');
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('does not verify while typing digit by digit — Verify is still needed', () => {
    const verifySpy = spyOn(auth, 'verifyOtp');
    '123456'.split('').forEach((digit, i) => {
      const box = otpBoxes()[i];
      box.value = digit;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    });
    expect(component.otpCode).toBe('123456');
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('a second autofill while the first check is still running is ignored', () => {
    const verifySpy = spyOn(auth, 'verifyOtp').and.returnValue(NEVER);
    autofill('123456');
    autofill('654321');
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('a wrong autofilled code shows the error and clears the code for another try', () => {
    spyOn(auth, 'verifyOtp').and.returnValue(throwError(() => ({ message: 'That code is invalid.' })));
    autofill('123456');
    expect(component.error()).toBe('That code is invalid.');
    expect(component.otpCode).toBe('');
    expect(component.submitting()).toBeFalse();
  });

  it('a new number moves on to the name step after an autofilled code', () => {
    spyOn(auth, 'verifyOtp').and.returnValue(of({ status: 'name_required', signupToken: 'tok', expiresInSeconds: 600, maskedMobileNumber: '******7161' } as any));
    autofill('123456');
    expect(component.step()).toBe('enter-name');
  });
});
