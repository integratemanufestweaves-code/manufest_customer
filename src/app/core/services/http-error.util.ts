import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ApiError, ApiErrorBody } from '../models/api.models';

/**
 * `manufest_be`'s `validate.middleware.js` throws `ValidationError('Request
 * validation failed', errors)` for *every* validated route in the backend
 * (not an auth-specific shape) — `errors` is `{body?, query?, params?}`,
 * each `Zod`'s `result.error.flatten().fieldErrors`
 * (`{[field]: string[]}`). The top-level `message` is always the same
 * generic "Request validation failed" — genuinely useless to show a
 * customer on its own (e.g. a weak password 422s with that message and
 * the actual "needs an uppercase letter" reason buried in
 * `details.body.password`). This turns those into one readable string so
 * every call site that already does `err?.message || 'fallback'` shows
 * the real reason without any further change.
 */
function humanizeFieldName(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;

  const parts: string[] = [];
  for (const section of ['body', 'query', 'params'] as const) {
    const fieldErrors = (details as Record<string, unknown>)[section];
    if (!fieldErrors || typeof fieldErrors !== 'object') continue;

    for (const [field, messages] of Object.entries(fieldErrors as Record<string, unknown>)) {
      if (!Array.isArray(messages) || messages.length === 0) continue;
      const label = humanizeFieldName(field);
      // Zod messages are often already self-descriptive prose ("Password
      // must contain a digit") — strip a duplicate leading field name
      // rather than showing "Password: Password must contain a digit".
      const leadingLabel = new RegExp(`^${label}\\s+`, 'i');
      const cleaned = messages.map((m) => (typeof m === 'string' ? m.replace(leadingLabel, '') : String(m)));
      parts.push(`${label}: ${cleaned.join(', ')}`);
    }
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * Same normalization every `*.service.ts` in this app already inlines as
 * its own private `rethrow()` (see product.service.ts/category.service.ts)
 * — pulled out once here for the batch of services added alongside
 * auth/cart/wishlist/customer/faq so that block isn't copy-pasted five more
 * times. Existing services keep their own inline copy unchanged (no
 * behavior difference, purely to avoid touching working files for a
 * refactor-only reason) — they're all read-only public GETs with no
 * user-editable form behind them, so the validation-details enrichment
 * below has no real call site there anyway.
 */
export function rethrowApiError(err: unknown): Observable<never> {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | undefined;
    if (body && body.success === false && body.error) {
      const detailMessage = formatValidationDetails(body.error.details);
      const apiError: ApiError = {
        code: body.error.code,
        message: detailMessage || body.error.message,
        requestId: body.error.requestId,
        details: body.error.details,
      };
      return throwError(() => apiError);
    }
    return throwError(() => ({ code: 'NETWORK_ERROR', message: err.message || 'Could not reach the server.' } as ApiError));
  }
  return throwError(() => ({ code: 'UNKNOWN_ERROR', message: 'Something went wrong.' } as ApiError));
}
