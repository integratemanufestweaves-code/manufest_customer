import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ConsentService } from '../../core/services/consent.service';

/**
 * `/privacy` (the footer's "Privacy Settings", and the Privacy Policy link
 * on the sign-in screen): the visitor's cookie choice, the signed-in
 * customer's offers opt-in, and a plain summary of what the store collects.
 * The summary describes what this codebase actually does; the formal
 * policy text still needs legal review before launch.
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent implements OnInit {
  readonly consent = inject(ConsentService);
  readonly auth = inject(AuthService);

  /** null while loading or signed out. */
  readonly marketing = signal<boolean | null>(null);
  readonly marketingSaving = signal(false);
  readonly marketingError = signal<string | null>(null);
  readonly marketingSaved = signal(false);

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) return;
    this.consent.list().subscribe({
      next: (records) => this.marketing.set(records.find((r) => r.type === 'marketing')?.granted ?? false),
      error: () => this.marketing.set(false),
    });
  }

  openCookieSettings(): void {
    this.consent.preferencesOpen.set(true);
  }

  toggleMarketing(granted: boolean): void {
    this.marketingSaving.set(true);
    this.marketingError.set(null);
    this.marketingSaved.set(false);
    this.consent.setMarketing(granted).subscribe((records) => {
      this.marketingSaving.set(false);
      if (!records) {
        this.marketingError.set('Could not save your choice. Please try again.');
        return;
      }
      this.marketing.set(granted);
      this.marketingSaved.set(true);
    });
  }
}
