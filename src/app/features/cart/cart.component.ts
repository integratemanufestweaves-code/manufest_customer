import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { CartItem } from '../../core/models/cart.models';

/**
 * `GET/PUT/DELETE /customer/cart*` (`cart.api.js`) — see that file's own
 * header comment: variant-level, stock-checked on every mutation, and
 * **not a real reservation** (nothing holds these units for this customer).
 * `loadCartView()` now also returns each line's variant-level `thumbnail`
 * (2026-09-13) — resolved through `ProductService.mediaSrc()`, same pattern
 * as `ProductCardComponent`/`WishlistComponent`. Checkout is now backed by
 * the `orders` module (`orders.api.js`) — "Proceed to checkout" routes to
 * `/checkout`, see `CheckoutComponent`.
 *
 * `POST /checkout` accepts an optional `cartItemUuids` subset (2026-09-13)
 * instead of always converting the whole cart — this page tracks which
 * lines are checked via `deselectedUuids` (everything defaults to
 * selected, since that's the common case; tracking exclusions rather than
 * inclusions means a newly-added cart line is selected automatically
 * without this component needing to notice it arrived) and hands the
 * selected subset to `CartService.setCheckoutSelection()` before routing
 * to `/checkout`.
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
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  readonly cart = this.cartService.cart;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Per-item uuid, disables that row's controls while a mutation is in
   * flight — prevents a double-click firing two overlapping PUTs. */
  readonly pendingItem = signal<string | null>(null);

  /** Cart item uuids whose resolved thumbnail 404d — see
   * ProductCardComponent's `thumbnailBroken` for why this falls back to the
   * color swatch instead of a broken-image glyph. */
  private readonly brokenThumbnails = signal<ReadonlySet<string>>(new Set());

  /** Cart item uuids the customer has unchecked — see this component's
   * header comment for why exclusions (not inclusions) are tracked. */
  private readonly deselectedUuids = signal<ReadonlySet<string>>(new Set());

  /** An item this app can't check out as-is: either completely out of
   * stock, or the quantity in the cart exceeds what's actually available
   * right now (someone else bought the rest, or the seller lowered stock,
   * since this was added). Both cases fail the same server-side
   * `INSUFFICIENT_STOCK` check at checkout — surfacing it here means the
   * customer finds out on the cart page, not after filling in an address
   * and clicking "Place order". */
  hasStockIssue(item: CartItem): boolean {
    return item.quantity > item.quantityAvailable;
  }

  isOutOfStock(item: CartItem): boolean {
    return item.quantityAvailable <= 0;
  }

  readonly selectedItems = computed(() =>
    this.cart()
      .items.filter((item) => !this.deselectedUuids().has(item.uuid))
      // Belt-and-suspenders — `toggleItem`/`isSelected` already refuse to
      // (re-)select a stock-issue item, but this keeps `selectedItems`
      // correct even if an item's stock drops to 0 *after* it was already
      // selected (e.g. a background `refresh()` picks up someone else
      // buying the last unit while this page is still open).
      .filter((item) => !this.hasStockIssue(item)),
  );
  readonly selectedCount = computed(() => this.selectedItems().length);
  readonly stockIssueCount = computed(() => this.cart().items.filter((item) => this.hasStockIssue(item)).length);
  readonly selectedSubtotal = computed(() => this.selectedItems().reduce((sum, item) => sum + (item.lineTotal || 0), 0));
  readonly allSelected = computed(() => {
    const items = this.cart().items;
    return items.length > 0 && items.every((item) => this.hasStockIssue(item) || !this.deselectedUuids().has(item.uuid));
  });

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

  thumbnailSrc(item: CartItem): string | null {
    if (this.brokenThumbnails().has(item.uuid)) return null;
    return this.productService.mediaSrc(item.variant.thumbnail?.url);
  }

  onThumbnailError(item: CartItem): void {
    this.brokenThumbnails.update((set) => new Set(set).add(item.uuid));
  }

  isSelected(item: CartItem): boolean {
    return !this.hasStockIssue(item) && !this.deselectedUuids().has(item.uuid);
  }

  toggleItem(item: CartItem): void {
    if (this.hasStockIssue(item)) return;
    this.deselectedUuids.update((set) => {
      const next = new Set(set);
      if (next.has(item.uuid)) {
        next.delete(item.uuid);
      } else {
        next.add(item.uuid);
      }
      return next;
    });
  }

  toggleAll(): void {
    this.deselectedUuids.set(this.allSelected() ? new Set(this.cart().items.map((item) => item.uuid)) : new Set());
  }

  goToCheckout(): void {
    if (this.selectedCount() === 0) return;
    this.cartService.setCheckoutSelection(this.selectedItems().map((item) => item.uuid));
    this.router.navigate(['/checkout']);
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
