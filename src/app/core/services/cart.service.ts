import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { AddCartItemRequest, CartView } from '../models/cart.models';
import { rethrowApiError } from './http-error.util';

const EMPTY_CART: CartView = { items: [], itemCount: 0, total: 0 };

/**
 * Client for manufest_be's `cart` module (`src/modules/cart/cart.api.js`,
 * mounted `/api/v1/customer/cart`) — every route requires an authenticated
 * customer. Holds the current cart in a signal so the header's item-count
 * badge and the cart page share one source of truth instead of each
 * fetching independently.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly base = `${environment.apiBaseUrl}/customer/cart`;
  private readonly http = inject(HttpClient);

  private readonly cartSignal = signal<CartView>(EMPTY_CART);
  readonly cart = this.cartSignal.asReadonly();
  readonly itemCount = computed(() => this.cartSignal().itemCount);

  /** Lets "Add to cart" buttons switch to "Go to cart" once the product
   * (card) or the exact variant (detail page) is already in the cart. */
  private readonly variantUuidsInCart = computed(() => new Set(this.cartSignal().items.map((item) => item.variant.uuid)));
  private readonly productUuidsInCart = computed(() => new Set(this.cartSignal().items.map((item) => item.product.uuid)));

  isVariantInCart(variantUuid: string): boolean {
    return this.variantUuidsInCart().has(variantUuid);
  }

  isProductInCart(productUuid: string): boolean {
    return this.productUuidsInCart().has(productUuid);
  }

  /** Every mutation returns the whole cart. Each request takes a number,
   * and a response is applied only if no later-started request has
   * already been applied — otherwise a slow response for an earlier +/−
   * tap (common on mobile data) would overwrite the newer cart and show
   * a stale quantity/total. */
  private mutationSeq = 0;
  private appliedSeq = 0;

  private applyMutation(seq: number, cart: CartView): void {
    if (seq < this.appliedSeq) return;
    this.appliedSeq = seq;
    this.cartSignal.set(cart);
  }

  /** Which `cart_items.uuid`s the cart page's checkbox selection had
   * checked when "Proceed to checkout" was clicked — read by
   * `CheckoutComponent` so a partial selection carries across the
   * `/cart` → `/checkout` navigation without round-tripping through the
   * server. `null` means "no selection made this session" (e.g. a direct
   * link to `/checkout`), which `CheckoutComponent` treats as "the whole
   * cart", matching `POST /checkout`'s own default when `cartItemUuids` is
   * omitted. */
  private readonly checkoutSelectionSignal = signal<string[] | null>(null);
  readonly checkoutSelection = this.checkoutSelectionSignal.asReadonly();

  setCheckoutSelection(cartItemUuids: string[]): void {
    this.checkoutSelectionSignal.set(cartItemUuids);
  }

  clearCheckoutSelection(): void {
    this.checkoutSelectionSignal.set(null);
  }

  /** Call once after login (and at app bootstrap, if already authenticated)
   * — silently resets to empty on failure (e.g. not logged in yet) rather
   * than surfacing an error nobody's looking at. */
  refresh(): void {
    this.http
      .get<ApiSuccess<CartView>>(this.base)
      .pipe(
        map((res) => res.data),
        catchError(() => [EMPTY_CART]),
      )
      .subscribe((cart) => this.cartSignal.set(cart));
  }

  /** Clears cart state without a network call — for logout, where the
   * server-side cart still exists for next time but nothing here should
   * keep showing a signed-out visitor someone else's items. */
  clearLocalState(): void {
    this.cartSignal.set(EMPTY_CART);
    this.checkoutSelectionSignal.set(null);
  }

  addItem(payload: AddCartItemRequest): Observable<CartView> {
    const seq = ++this.mutationSeq;
    return this.http.post<ApiSuccess<CartView>>(`${this.base}/items`, payload).pipe(
      tap((res) => this.applyMutation(seq, res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  updateItemQuantity(cartItemUuid: string, quantity: number): Observable<CartView> {
    const seq = ++this.mutationSeq;
    return this.http.put<ApiSuccess<CartView>>(`${this.base}/items/${cartItemUuid}`, { quantity }).pipe(
      tap((res) => this.applyMutation(seq, res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  removeItem(cartItemUuid: string): Observable<CartView> {
    const seq = ++this.mutationSeq;
    return this.http.delete<ApiSuccess<CartView>>(`${this.base}/items/${cartItemUuid}`).pipe(
      tap((res) => this.applyMutation(seq, res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

  /** "Move to wishlist": the server wishlists the line's product and drops
   * the line in one transaction, returning the updated cart. The caller
   * refreshes WishlistService so the header badge picks it up. */
  moveToWishlist(cartItemUuid: string): Observable<CartView> {
    const seq = ++this.mutationSeq;
    return this.http.post<ApiSuccess<CartView>>(`${this.base}/items/${cartItemUuid}/move-to-wishlist`, {}).pipe(
      tap((res) => this.applyMutation(seq, res.data)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }

    clear(): Observable<{ status: string }> {
    const seq = ++this.mutationSeq;
    return this.http.delete<ApiSuccess<{ status: string }>>(this.base).pipe(
      tap(() => this.applyMutation(seq, EMPTY_CART)),
      map((res) => res.data),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
