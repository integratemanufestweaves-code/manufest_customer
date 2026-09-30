import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CaptchaAnswer } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';

/**
 * Same model as manufest_seller's CaptchaComponent (distorted 5-character
 * code, retype it, refresh button), but server-verified: manufest_be draws
 * the image (`GET /auth/customer/captcha`) and checks the answer itself when
 * the host form submits. The answer is never in the browser, so there is no
 * client-side "match" check. Each image allows one attempt, so the host calls
 * `refresh()` after every submit that didn't move on.
 */
@Component({
  selector: 'app-captcha',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './captcha.component.html',
  styleUrl: './captcha.component.scss',
})
export class CaptchaComponent implements OnInit {
  private readonly auth = inject(AuthService);

  /** `null` until something is typed, and again after every refresh. */
  @Output() answerChange = new EventEmitter<CaptchaAnswer | null>();

  readonly image = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  answer = '';
  private captchaId: string | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    // Only tell the host when it could be holding an answer. On first
    // render it already starts at null, and emitting from ngOnInit into
    // the parent's template would be a change-after-check.
    if (this.answer) this.answerChange.emit(null);
    this.answer = '';
    this.captchaId = null;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.auth.getCaptcha().subscribe({
      next: (captcha) => {
        this.captchaId = captcha.captchaId;
        this.image.set(captcha.image);
        this.loading.set(false);
      },
      error: () => {
        this.image.set(null);
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  onAnswerInput(value: string): void {
    this.answer = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    this.answerChange.emit(this.captchaId && this.answer ? { captchaId: this.captchaId, answer: this.answer } : null);
  }
}
