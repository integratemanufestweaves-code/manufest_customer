import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { TestModeBannerComponent } from './shared/test-mode-banner/test-mode-banner.component';
import { CookieConsentComponent } from './shared/cookie-consent/cookie-consent.component';
import { AnalyticsService } from './core/services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, TestModeBannerComponent, CookieConsentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'manufest-customer';

  constructor() {
    // Page views + live presence; sends nothing until cookies are accepted.
    inject(AnalyticsService).start(inject(DestroyRef));
  }
}
