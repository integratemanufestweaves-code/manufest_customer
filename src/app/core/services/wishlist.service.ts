import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { WishlistItem } from '../models/wishlist.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `wishlist` module
 * (`src/modules/wishlist/wishlist.api.js`, mounted `/api/v1/customer/wishlist`)
 * — product-level, not variant-level (see that file's own header comment).
 * Same "signal holds current state for header badge + page" shape as
 * `CartService`.
 */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly base = `${environment.apiBaseUrl}/customer/wishlist`;
  private readonly http = inject(HttpClient);

  private readonly itemsSignal = signal<WishlistItem[]>([]);
  readonly items = this.itemsSignal.asReadonly();
  readonly itemCount = computed(() => this.itemsSignal().length);

  /** `productUuid -> true` for O(1) "is this already wishlisted" checks
   * from a product card without scanning `items()` on every render. */
  readonly wishlistedProductUuids = computed(() => new Set(this.itemsSignal().map((i) => i.product.uuid)));

  refresh(): void {
    this.http
      .get<ApiSuccess<WishlistItem[]>>(this.base)
      .pipe(
        map((res) => res.data),
        catchError(() => [[] as WishlistItem[]]),
      )
      .subscribe((items) => this.itemsSignal.set(items));
  }

  clearLocalState(): void {
    this.itemsSignal.set([]);
  }

  isWishlisted(productUuid: string): boolean {
    return this.wishlistedProductUuids().has(productUuid);
  }

  add(productUuid: string): Observable<WishlistItem[]> {
    return this.http.post<ApiSuccess<WishlistItem[]>>(`${this.base}/items`, { productUuid }).pipe(
      tap((res) => this.itemsSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  remove(wishlistItemUuid: string): Observable<WishlistItem[]> {
    return this.http.delete<ApiSuccess<WishlistItem[]>>(`${this.base}/items/${wishlistItemUuid}`).pipe(
      tap((res) => this.itemsSignal.set(res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** Convenience for a product-card heart toggle — finds the wishlist item
   * for this product (if any) and removes it, otherwise adds it. Two round
   * trips in the worst case (one to know the item uuid isn't cached, one to
   * act) never happen here since `items()` is already in memory. */
  toggle(productUuid: string): Observable<WishlistItem[]> {
    const existing = this.itemsSignal().find((i) => i.product.uuid === productUuid);
    return existing ? this.remove(existing.uuid) : this.add(productUuid);
  }

  /** `POST /customer/wishlist/notify-me` — registers a back-in-stock
   * request for an out-of-stock product (see wishlist.api.js's own header
   * comment on that route: product-level, not variant-level). Doesn't
   * touch `itemsSignal` — this isn't a wishlist mutation, it's a separate
   * subscription the wishlist page happens to be the one place offering. */
  notifyMe(productUuid: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notify-me`, { productUuid }).pipe(
      map(() => undefined),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
