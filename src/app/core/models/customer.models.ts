/**
 * Shapes for manufest_be's `users` module customer-facing routes
 * (`src/modules/users/users.api.js`'s `customerRouter`, mounted at
 * `/api/v1/customer/*`) — read directly from that file, not just the
 * knowledge-base summary.
 */

export interface UpdateProfileRequest {
  fullName: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** ISO date string (`YYYY-MM-DD`) — `usersValidation.updateProfile` coerces
   * via `z.coerce.date()`, so any parseable date string works. */
  dob?: string;
}

export interface UpdateProfilePhotoRequest {
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

/**
 * `GET /customer/addresses` returns raw DB rows (snake_case) — unlike every
 * other endpoint in this app, this route does no camelCase mapping
 * server-side (`res.json(successResponse(rows))` directly). Modeled here
 * as the wire shape; `CustomerService` maps it to `Address` (camelCase),
 * same `ApiRow -> mapped` split `category.models.ts` already uses.
 */
export interface AddressApiRow {
  uuid: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country_code: string;
  is_default: 0 | 1;
  created_at: string;
}

export interface Address {
  uuid: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
}

/** Body shape for both `POST /addresses` and `PUT /addresses/:uuid` —
 * `usersValidation.addressInput` is shared between create/update. */
export interface AddressRequest {
  label?: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  /** Exactly 2 characters (`z.string().length(2)`) — e.g. `"IN"`. */
  countryCode: string;
  isDefault?: boolean;
}
