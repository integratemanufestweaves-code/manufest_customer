/**
 * Minimal ambient type for the `Razorpay` global that
 * `https://checkout.razorpay.com/v1/checkout.js` (lazily injected by
 * `RazorpayCheckoutService`, not loaded up front in index.html) attaches to
 * `window`. There's no official `@types/razorpay` package for the
 * client-side Checkout widget (only for the server-side Node SDK, which
 * this frontend never uses) — kept intentionally narrow to just the
 * options/instance shape `RazorpayCheckoutService` actually calls.
 * Declared as an optional `Window` property (not a bare ambient `const`)
 * since it genuinely doesn't exist until that script has loaded.
 */
interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open(): void;
}

interface Window {
  Razorpay?: {
    new (options: RazorpayCheckoutOptions): RazorpayCheckoutInstance;
  };
}
