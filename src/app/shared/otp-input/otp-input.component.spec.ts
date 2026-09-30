import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { OtpInputComponent } from './otp-input.component';

@Component({
  standalone: true,
  imports: [FormsModule, OtpInputComponent],
  template: `<app-otp-input name="code" [(ngModel)]="code" />`,
})
class HostComponent {
  code = '';
}

describe('OtpInputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const boxes = () => Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];

  function type(index: number, value: string): void {
    const box = boxes()[index];
    box.value = value;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }));

  it('renders six single-digit numeric boxes', () => {
    expect(boxes().length).toBe(6);
    boxes().forEach((b) => {
      expect(b.inputMode).toBe('numeric');
      expect(b.maxLength).toBe(1);
    });
    expect(boxes()[0].getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('drops non-digits and advances focus on each digit', () => {
    type(0, 'a');
    expect(boxes()[0].value).toBe('');
    expect(host.code).toBe('');

    type(0, '4');
    expect(host.code).toBe('4');
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it('spreads a pasted/autofilled code across the boxes', () => {
    type(0, '12-34 56');
    expect(host.code).toBe('123456');
    expect(boxes().map((b) => b.value)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('steps back on Backspace from an empty box', () => {
    type(0, '12');
    boxes()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    fixture.detectChanges();
    expect(host.code).toBe('1');
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it('shows a value written through ngModel', fakeAsync(() => {
    host.code = '9876';
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(boxes().map((b) => b.value)).toEqual(['9', '8', '7', '6', '', '']);
  }));
});
