import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CUSTOMER_SUPPORT, RETURN_GUIDELINE } from '../../core/constants/customer-support';

/**
 * Help center (2026-10-08) — `/help-center`, linked from the menu drawer's
 * account section, the account page and the footer. Shows the customer
 * support team's phone numbers (tap to call), email and hours, the return
 * guideline, and links to the FAQ and the customer's orders. Static: the
 * details live in `core/constants/customer-support.ts`.
 */
@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './help-center.component.html',
  styleUrl: './help-center.component.scss',
})
export class HelpCenterComponent {
  readonly support = CUSTOMER_SUPPORT;
  readonly returnGuideline = RETURN_GUIDELINE;
}
