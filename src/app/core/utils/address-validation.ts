import { AddressRequest } from '../models/customer.models';

export type AddressField = 'recipientName' | 'phone' | 'line1' | 'city' | 'postalCode';
export type AddressFieldErrors = Partial<Record<AddressField, string>>;

const INDIAN_MOBILE = /^[6-9][0-9]{9}$/;
const INDIAN_PIN_CODE = /^[1-9][0-9]{5}$/;

/** Digits only, minus a leading +91 / 91 / 0, so "+91 98765 43210" and
 * "098765-43210" both check as the 10-digit number they are. */
function nationalMobileDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Trims every text field, so a value of only spaces counts as empty and
 * stray spaces aren't saved. */
export function trimAddressForm(f: AddressRequest): AddressRequest {
  return {
    ...f,
    label: f.label?.trim() ?? '',
    recipientName: f.recipientName.trim(),
    phone: f.phone.trim(),
    line1: f.line1.trim(),
    line2: f.line2?.trim() ?? '',
    city: f.city.trim(),
    state: f.state?.trim() ?? '',
    postalCode: f.postalCode.trim(),
  };
}

/** Per-field messages for the (India-only) address form; empty when valid.
 * Expects an already-trimmed form. */
export function validateAddressForm(f: AddressRequest): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (!f.recipientName) errors.recipientName = 'Enter the recipient’s name.';
  if (!f.phone) errors.phone = 'Enter a phone number.';
  else if (!INDIAN_MOBILE.test(nationalMobileDigits(f.phone))) errors.phone = 'Enter a valid 10-digit mobile number.';
  if (!f.line1) errors.line1 = 'Enter the address.';
  if (!f.city) errors.city = 'Enter the city.';
  if (!f.postalCode) errors.postalCode = 'Enter the PIN code.';
  else if (!INDIAN_PIN_CODE.test(f.postalCode)) errors.postalCode = 'Enter a valid 6-digit PIN code.';
  return errors;
}
