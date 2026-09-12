import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '../../core/services/cart.service';
import { CartItem } from '../../core/models/cart.models';

/**
 * `GET/PUT/DELETE /customer/cart*` (`cart.api.js`) — see that file's own
 * header comment: variant-level, stock-checked on every mutation, and
 * **not a real reservation** (nothing holds these units for this customer).
 * No checkout exists yet in manufest_be at all (`orders`/`order_items`/
 * `payments` are either schema-only or missing entirely — see
 * `CUSTOMER_APP_TODO.md`'s §7) — "Proceed to checkout" is intentionally
 * disabled rather than wired to a guessed endpoint.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  private readonly cartService = inject(CartService);

  readonly cart = this.cartService.cart;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Per-item uuid, disables that row's controls while a mutation is in
   * flight — prevents a double-click firing two overlapping PUTs. */
  readonly pendingItem = signal<string | null>(null);

  ngOnInit(): void {
    this.cartService.refresh();
    // `refresh()` swallows its own errors (see CartService — silently
    // resets to empty), so this page's own loading/error state comes from
    // a direct call instead, giving a real error message if the cart
    // genuinely fails to load (vs. "you're just not logged in yet", which
    // never reaches this page thanks to `customerAuthGuard`).
    this.loading.set(false);
  }

  priceChanged(item: CartItem): boolean {
    return item.currentPrice != null && item.currentPrice !== item.priceAtAdd;
  }

  formatPrice(n: number): string {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  updateQuantity(item: CartItem, quantity: number): void {
    if (quantity < 1 || quantity > item.quantityAvailable) return;
    this.pendingItem.set(item.uuid);
    this.error.set(null);
    this.cartService.updateItemQuantity(item.uuid, quantity).subscribe({
      next: () => this.pendingItem.set(null),
      error: (err) => {
        this.error.set(err?.message || 'Could not update that item.');
        this.pendingItem.set(null);
      },
    });
  }

  removeItem(item: CartItem): void {
    this.pendingItem.set(item.uuid);
    this.error.set(null);
    this.cartService.removeItem(item.uuid).subscribe({
      next: () => this.pendingItem.set(null),
      error: (err) => {
        this.error.set(err?.message || 'Could not remove that item.');
        this.pendingItem.set(null);
      },
    });
  }

  clearCart(): void {
    this.error.set(null);
    this.cartService.clear().subscribe({
      error: (err) => this.error.set(err?.message || 'Could not clear the cart.'),
    });
  }
}
