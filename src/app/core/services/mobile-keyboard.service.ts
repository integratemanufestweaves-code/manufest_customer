import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Fields whose Enter means "done typing", not "new line". */
const SINGLE_LINE_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'number', 'password', 'url']);

/** Taps on these must not close the keyboard: another field, or a
 * suggestion list that keeps focus in its input on purpose (the header
 * search's `mousedown` preventDefault). `data-keep-keyboard` opts any other
 * element out. */
const KEEP_KEYBOARD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="option"], [data-keep-keyboard]';

/**
 * Phones (iOS Safari especially) only hide the on-screen keyboard when the
 * focused field loses focus, and neither pressing Enter/Search/Go nor
 * tapping blank page space does that by itself, so the keyboard stayed up
 * after the customer finished typing. On touch devices only, this blurs the
 * focused field:
 * - after Enter in a single-line input (after the event, so the form's own
 *   submit still runs first);
 * - on a tap anywhere outside a field.
 * Started once from AppComponent.
 */
@Injectable({ providedIn: 'root' })
export class MobileKeyboardService {
  private readonly document = inject(DOCUMENT);
  private started = false;

  start(): void {
    const view = this.document.defaultView;
    if (this.started || !view?.matchMedia?.('(pointer: coarse)').matches) return;
    this.started = true;

    this.document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !SINGLE_LINE_INPUT_TYPES.has(target.type)) return;
      view.setTimeout(() => {
        if (this.document.activeElement === target) target.blur();
      });
    });

    this.document.addEventListener(
      'touchstart',
      (event: TouchEvent) => {
        const active = this.document.activeElement;
        if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
        const target = event.target;
        if (target instanceof Element && target.closest(KEEP_KEYBOARD_SELECTOR)) return;
        active.blur();
      },
      { passive: true },
    );
  }
}
