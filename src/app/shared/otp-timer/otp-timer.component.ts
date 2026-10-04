import { Component, Input, OnChanges, OnDestroy, computed, signal } from '@angular/core';

/**
 * Live "Code valid for m:ss" readout for an OTP screen, switching to
 * "Code expired. Request a new one." at zero. Purely informational — the
 * backend enforces the real expiry. Same look/wording as the seller and
 * admin apps' `app-otp-timer`.
 *
 * Feed it the `expiresInSeconds` from whichever response just issued a code,
 * plus `issuedAt` (e.g. `Date.now()` when that response arrived). A resend
 * usually returns the *same* `expiresInSeconds`, which on its own wouldn't
 * count as an input change — the new `issuedAt` is what restarts the
 * countdown. `null`/`undefined` seconds hides the timer.
 */
@Component({
  selector: 'app-otp-timer',
  standalone: true,
  template: `
    @if (started()) {
      @if (secondsLeft() > 0) {
        <p class="otp-timer" aria-live="polite">Code valid for <strong>{{ formatted() }}</strong></p>
      } @else {
        <p class="otp-timer otp-timer--expired" role="alert">Code expired. Request a new one.</p>
      }
    }
  `,
  styles: [
    `
      .otp-timer {
        font-size: 13px;
        color: var(--color-text-muted);
        margin: 0;
      }

      .otp-timer--expired {
        color: var(--color-danger);
      }
    `,
  ],
})
export class OtpTimerComponent implements OnChanges, OnDestroy {
  @Input() expiresInSeconds: number | null | undefined = null;
  @Input() issuedAt: number | null | undefined = null;

  private intervalId?: ReturnType<typeof setInterval>;

  readonly started = signal(false);
  readonly secondsLeft = signal(0);
  readonly formatted = computed(() => {
    const total = this.secondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  ngOnChanges(): void {
    this.restart(this.expiresInSeconds ?? null);
  }

  private restart(total: number | null): void {
    this.clearTimer();

    if (total === null) {
      this.started.set(false);
      this.secondsLeft.set(0);
      return;
    }

    this.started.set(true);
    this.secondsLeft.set(Math.max(0, Math.floor(total)));

    if (this.secondsLeft() > 0) {
      this.intervalId = setInterval(() => {
        this.secondsLeft.update((seconds) => Math.max(0, seconds - 1));
        if (this.secondsLeft() === 0) this.clearTimer();
      }, 1000);
    }
  }

  private clearTimer(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
