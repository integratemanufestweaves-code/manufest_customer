import { formatPrice } from './format-price';

describe('formatPrice', () => {
  describe('whole-rupee amounts', () => {
    it('omits paise entirely (no ".00")', () => {
      expect(formatPrice(2000)).toBe('₹2,000');
    });

    it('formats zero as ₹0', () => {
      expect(formatPrice(0)).toBe('₹0');
    });

    it('uses Indian digit grouping (lakh/crore), not Western thousands', () => {
      expect(formatPrice(100000)).toBe('₹1,00,000');
      expect(formatPrice(12345678)).toBe('₹1,23,45,678');
    });
  });

  describe('amounts with paise', () => {
    it('keeps paise instead of rounding them away (the checkout-vs-Razorpay mismatch bug)', () => {
      expect(formatPrice(1908.46)).toBe('₹1,908.46');
    });

    it('always shows two paise digits, never one', () => {
      expect(formatPrice(2730.9)).toBe('₹2,730.90');
      expect(formatPrice(1999.6)).toBe('₹1,999.60');
    });

    it('shows a single paisa', () => {
      expect(formatPrice(10.01)).toBe('₹10.01');
    });

    it('groups paise amounts in the Indian style too', () => {
      expect(formatPrice(123456.78)).toBe('₹1,23,456.78');
    });
  });

  describe('floating-point noise', () => {
    it('rounds sub-paisa noise to the nearest paisa', () => {
      expect(formatPrice(0.1 + 0.2)).toBe('₹0.30');
    });

    it('treats an amount that rounds to a whole rupee as whole (no ".00")', () => {
      expect(formatPrice(1999.999)).toBe('₹2,000');
      expect(formatPrice(2000.004)).toBe('₹2,000');
    });
  });
});
