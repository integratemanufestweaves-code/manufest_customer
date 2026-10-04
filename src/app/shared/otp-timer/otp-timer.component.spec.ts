import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';

import { OtpTimerComponent } from './otp-timer.component';

describe('OtpTimerComponent', () => {
  let fixture: ComponentFixture<OtpTimerComponent>;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  function issue(seconds: number | null, issuedAt: number | null = 1) {
    fixture.componentRef.setInput('expiresInSeconds', seconds);
    fixture.componentRef.setInput('issuedAt', issuedAt);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(OtpTimerComponent);
  });

  it('renders nothing until a code has been issued', () => {
    fixture.detectChanges();
    expect(text()).toBe('');
  });

  it('shows the remaining time as m:ss', fakeAsync(() => {
    issue(60);
    expect(text()).toBe('Code valid for 1:00');
    tick(1000);
    fixture.detectChanges();
    expect(text()).toBe('Code valid for 0:59');
    discardPeriodicTasks();
  }));

  it('switches to an expired message at zero (instead of disappearing)', fakeAsync(() => {
    issue(2);
    tick(2000);
    fixture.detectChanges();
    expect(text()).toBe('Code expired. Request a new one.');
    expect(fixture.nativeElement.querySelector('.otp-timer--expired')).not.toBeNull();
  }));

  it('a resend with the SAME duration still restarts the countdown (new issuedAt)', fakeAsync(() => {
    issue(5, 100);
    tick(5000);
    fixture.detectChanges();
    expect(text()).toBe('Code expired. Request a new one.');

    issue(5, 200);
    expect(text()).toBe('Code valid for 0:05');
    discardPeriodicTasks();
  }));

  it('hides again when the code is cleared', fakeAsync(() => {
    issue(30);
    issue(null, null);
    expect(text()).toBe('');
  }));

  it('stops ticking once destroyed', fakeAsync(() => {
    issue(30);
    fixture.destroy();
    tick(31000); // would throw "periodic timer(s) still in the queue" if the interval leaked
  }));
});
