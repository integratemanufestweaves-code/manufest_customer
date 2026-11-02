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

/**
 * Whole-rupee price for browsing a product (cards, product page, wishlist):
 * any paise round up, never down (₹2,730.10 shows ₹2,731). manufest_be stores
 * selling prices rounded up since 0106, so this matches what is charged; it
 * still matters for the strike-through price, which keeps its paise. Paise
 * are settled first so float noise can't add a rupee.
 */
export function formatRoundedUpPrice(n: number): string {
  const rupees = Math.ceil(Math.round(n * 100) / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}
