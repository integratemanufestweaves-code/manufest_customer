import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ConsentService } from '../../core/services/consent.service';

/**
 * Cookie consent, the way most Indian/EU storefronts do it:
 *  - a bottom banner on the first visit (and again after POLICY_VERSION
 *    changes) with "Accept all" and "Reject optional" given equal weight,
 *    plus "Customize";
 *  - a preferences dialog (native <dialog>, so focus is trapped and Esc
 *    closes it) with Essential (always on), Analytics and Advertising.
 * The same dialog opens from the footer's "Cookie settings" and the
 * Privacy page via ConsentService.preferencesOpen.
 * Nothing optional loads until a choice is made (AnalyticsService).
 */
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
})
export class CookieConsentComponent {
  readonly consent = inject(ConsentService);

  @ViewChild('preferencesDialog') private dialogRef?: ElementRef<HTMLDialogElement>;

  analytics = false;
  ads = false;

  constructor() {
    effect(() => {
      if (this.consent.preferencesOpen()) this.openDialog();
    });
    // While the fixed banner is up, keep keyboard focus / scrolled-to
    // anchors clear of it.
    effect(() => {
      document.documentElement.style.scrollPaddingBottom = this.consent.decided() ? '' : '200px';
    });
  }

  acceptAll(): void {
    this.consent.saveCookiePreferences({ analytics: true, ads: true });
    this.closeDialog();
  }

  rejectOptional(): void {
    this.consent.saveCookiePreferences({ analytics: false, ads: false });
    this.closeDialog();
  }

  saveChoices(): void {
    this.consent.saveCookiePreferences({ analytics: this.analytics, ads: this.ads });
    this.closeDialog();
  }

  customize(): void {
    this.consent.preferencesOpen.set(true);
  }

  /** Esc / backdrop close: nothing saved, banner stays if still undecided. */
  onDialogClose(): void {
    this.consent.preferencesOpen.set(false);
  }

  private openDialog(): void {
    const current = this.consent.preferences();
    // A first-time visitor starts with optional cookies off; nothing is pre-ticked.
    this.analytics = current.analytics;
    this.ads = current.ads;
    // The view may not exist yet on the very first effect run.
    setTimeout(() => {
      const dialog = this.dialogRef?.nativeElement;
      if (dialog && !dialog.open) dialog.showModal();
    });
  }

  private closeDialog(): void {
    this.dialogRef?.nativeElement.close();
    this.consent.preferencesOpen.set(false);
  }
}
