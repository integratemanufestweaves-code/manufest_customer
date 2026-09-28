/**
 * Rupee display for every price in the app. Shows paise only when there
 * are any (₹2,730.90, but ₹2,731 stays ₹2,731) — prices are stored with
 * paise (GST/delivery are baked into `selling_price`), and rounding them
 * away made checkout show a different total than Razorpay charges.
 */
export function formatPrice(n: number): string {
  const paise = Math.round(n * 100);
  const digits = paise % 100 === 0 ? 0 : 2;
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
