import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OrderService } from '../../core/services/order.service';
import { OrderSummary } from '../../core/models/order.models';
import { OffsetMeta } from '../../core/models/api.models';
import { formatPrice } from '../../core/utils/format-price';

/** Status filter dropdown — deliberately short: all, plus the four states
 * a customer actually looks for. Each filters on one exact `order_status`
 * (the list route's `orderStatus` param). */
const ORDER_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'processing', label: 'Processing' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

/** Badge text for every `order_status` an order card can show — kept
 * separate from the filter above so trimming the filter never turns a card's
 * status back into a raw value like "partially_shipped". */
const ORDER_STATUS_LABELS: Record<string, string> = {
  payment_processing: 'Payment processing',
  placed: 'Placed',
  processing: 'Processing',
  shipped: 'Shipped',
  partially_shipped: 'Partially shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/**
 * `GET /customer/orders/list` (`orders.api.js`) — page-numbered (not
 * cursor-based, see that route's own `parseOffsetPagination`/
 * `buildOffsetMeta` usage), optionally filtered by `orderStatus`.
 * `ui_design/Profile - Orders.png` also shows a time-range filter and a
 * free-text order search — neither has a backing query param on this
 * route today, so only the status filter this app already has real data
 * for is built here.
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  private readonly orderService = inject(OrderService);

  readonly statusOptions = ORDER_STATUS_FILTERS;
  statusFilter = '';

  readonly orders = signal<OrderSummary[]>([]);
  readonly meta = signal<OffsetMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load(1);
  }

  onFilterChange(): void {
    this.load(1);
  }

  goToPage(page: number): void {
    if (page < 1) return;
    const totalPages = this.meta()?.totalPages ?? 1;
    if (page > totalPages) return;
    this.load(page);
  }

  formatPrice(n: number): string {
    return formatPrice(n);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  statusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.orderService.listOrders({ page, limit: 10, orderStatus: this.statusFilter || null }).subscribe({
      next: ({ items, meta }) => {
        this.orders.set(items);
        this.meta.set(meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load your orders.');
        this.loading.set(false);
      },
    });
  }
}
