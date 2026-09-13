import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Slim notice shown while the site is live for testing with dummy
 * products/data. Controlled entirely by `environment.showTestBanner` —
 * to remove it for the real launch, flip that flag to `false` (or delete
 * this component and its one usage in app.component.html).
 */
@Component({
  selector: 'app-test-mode-banner',
  standalone: true,
  imports: [],
  templateUrl: './test-mode-banner.component.html',
  styleUrl: './test-mode-banner.component.scss',
})
export class TestModeBannerComponent {
  show = environment.showTestBanner ?? false;
}
