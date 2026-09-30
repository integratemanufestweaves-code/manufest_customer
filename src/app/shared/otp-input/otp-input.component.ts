import { AfterViewInit, Component, OnInit, ElementRef, QueryList, ViewChildren, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * One box per digit for every OTP entry in this app (login, register,
 * profile mobile verification). Plugs into `[(ngModel)]` like a plain input
 * and always reports the digits joined into one string (`''` up to
 * `'123456'`), so callers just check `code.length === 6`.
 *
 * Digits only: anything else typed is dropped. Typing advances to the next
 * box, Backspace on an empty box steps back, and a pasted or SMS-autofilled
 * code (`autocomplete="one-time-code"` on the first box) is spread across
 * the boxes from wherever it lands.
 */
@Component({
  selector: 'app-otp-input',
  standalone: true,
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true }],
})
export class OtpInputComponent implements ControlValueAccessor, OnInit, AfterViewInit {
  readonly length = input(6);
  readonly autofocus = input(false);
  readonly invalid = input(false);
  readonly label = input('One-time code');

  @ViewChildren('box') private boxes!: QueryList<ElementRef<HTMLInputElement>>;

  readonly digits = signal<string[]>([]);
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    // writeValue can run first (ngModel) — only seed the empty boxes if it hasn't.
    if (this.digits().length !== this.length()) this.writeValue('');
  }

  ngAfterViewInit(): void {
    if (this.autofocus()) setTimeout(() => this.focusBox(0));
  }

  writeValue(value: string | null): void {
    const chars = String(value ?? '').replace(/\D/g, '').slice(0, this.length()).split('');
    this.digits.set(Array.from({ length: this.length() }, (_, i) => chars[i] ?? ''));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInput(index: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    let typed = el.value.replace(/\D/g, '');
    // Typing into a box that already holds a digit (caret after it instead
    // of the selection onFocus sets up) — keep the new digit, not both.
    const current = this.digits()[index];
    if (typed.length === 2 && current && typed[0] === current) typed = typed.slice(1);
    if (!typed) {
      el.value = '';
      this.setDigit(index, '');
      return;
    }
    // More than one digit in a single box = autofill or a mobile keyboard's
    // paste-into-field; spread it out rather than keeping only the first.
    this.fillFrom(index, typed);
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault();
      this.setDigit(index - 1, '');
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.length() - 1) {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  onPaste(index: number, event: ClipboardEvent): void {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    event.preventDefault();
    if (pasted) this.fillFrom(index, pasted);
  }

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  /** "Touched" only once focus leaves the whole group — not on every hop
   * between boxes, or a form showing errors on touched would flag the code
   * as invalid while it's still being typed. */
  onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && this.boxes?.some((box) => box.nativeElement === next)) return;
    this.onTouched();
  }

  private fillFrom(index: number, value: string): void {
    const next = [...this.digits()];
    let i = index;
    for (const ch of value) {
      if (i >= this.length()) break;
      next[i++] = ch;
    }
    this.digits.set(next);
    // The DOM value of the box that received the input still holds every
    // typed/pasted character until change detection re-renders it — sync now.
    this.boxes?.forEach((box, j) => (box.nativeElement.value = next[j]));
    this.onChange(next.join(''));
    this.focusBox(Math.min(i, this.length() - 1));
  }

  private setDigit(index: number, value: string): void {
    const next = [...this.digits()];
    next[index] = value;
    this.digits.set(next);
    this.onChange(next.join(''));
  }

  private focusBox(index: number): void {
    this.boxes?.get(index)?.nativeElement.focus();
  }
}
