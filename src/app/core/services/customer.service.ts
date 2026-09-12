import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { Address, AddressApiRow, AddressRequest, UpdateProfileRequest } from '../models/customer.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `users` module customer-facing routes
 * (`src/modules/users/users.api.js`'s `customerRouter`, mounted at
 * `/api/v1/customer/*`) — profile fields + address book. Distinct from
 * `AuthService` (session/identity) the same way `manufest_seller` splits
 * `AuthService` from account-settings services.
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly base = `${environment.apiBaseUrl}/customer`;
  private readonly http = inject(HttpClient);

  updateProfile(payload: UpdateProfileRequest): Observable<{ status: string }> {
    return this.http.patch<ApiSuccess<{ status: string }>>(`${this.base}/profile`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** "Warn and continue" on the backend — an unconfigured/failing upload
   * responds `{status:'skipped', warning}` rather than an HTTP error, so
   * callers should check `status` on success, not just `catchError`. */
  updateProfilePhoto(fileBase64: string, fileName: string, mimeType: string): Observable<{ status: string; profileImageUrl?: string; warning?: string }> {
    return this.http.patch<ApiSuccess<{ status: string; profileImageUrl?: string; warning?: string }>>(`${this.base}/profile/photo`, {
      fileBase64,
      fileName,
      mimeType,
    }).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  listAddresses(): Observable<Address[]> {
    return this.http.get<ApiSuccess<AddressApiRow[]>>(`${this.base}/addresses`).pipe(
      map((res) => res.data.map(toAddress)),
      catchError((err) => rethrowApiError(err)),
    );
  }

  createAddress(payload: AddressRequest): Observable<{ id: string }> {
    return this.http.post<ApiSuccess<{ id: string }>>(`${this.base}/addresses`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  updateAddress(addressUuid: string, payload: AddressRequest): Observable<{ status: string }> {
    return this.http.put<ApiSuccess<{ status: string }>>(`${this.base}/addresses/${addressUuid}`, payload).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  deleteAddress(addressUuid: string): Observable<{ status: string }> {
    return this.http.delete<ApiSuccess<{ status: string }>>(`${this.base}/addresses/${addressUuid}`).pipe(
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}

function toAddress(row: AddressApiRow): Address {
  return {
    uuid: row.uuid,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
  };
}
