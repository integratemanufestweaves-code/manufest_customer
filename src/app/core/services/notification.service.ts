import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../models/api.models';
import { CustomerNotification } from '../models/notification.models';
import { rethrowApiError } from './http-error.util';

/**
 * Client for manufest_be's `customer-notifications` module — see that
 * module's header comment. Same "signal holds current state for a header
 * badge + a page" shape `CartService`/`WishlistService` already use;
 * `unreadCount` is a separately-fetched signal (its own cheap endpoint,
 * not derived from `items()`) since the header badge needs it without
 * the page ever having loaded the full list.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly base = `${environment.apiBaseUrl}/customer/notifications`;
  private readonly http = inject(HttpClient);

  private readonly itemsSignal = signal<CustomerNotification[]>([]);
  readonly items = this.itemsSignal.asReadonly();

  private readonly unreadCountSignal = signal(0);
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly hasUnread = computed(() => this.unreadCountSignal() > 0);

  /** Populates `items()` — the notifications page's own list. */
  refresh(page = 1, limit = 20): void {
    const params = new HttpParams().set('page', page).set('limit', limit);
    this.http
      .get<ApiSuccess<CustomerNotification[]>>(this.base, { params })
      .pipe(
        map((res) => res.data),
        catchError(() => [[] as CustomerNotification[]]),
      )
      .subscribe((items) => this.itemsSignal.set(items));
  }

  /** Populates `unreadCount()` — the header badge. Cheap enough to call
   * from the app-wide init alongside cart/wishlist `refresh()` (see
   * app.config.ts's `initAuthSession`), independent of whether the
   * notifications page has ever been opened. */
  refreshUnreadCount(): void {
    this.http
      .get<ApiSuccess<{ unreadCount: number }>>(`${this.base}/unread-count`)
      .pipe(
        map((res) => res.data.unreadCount),
        catchError(() => [0]),
      )
      .subscribe((count) => this.unreadCountSignal.set(count));
  }

  clearLocalState(): void {
    this.itemsSignal.set([]);
    this.unreadCountSignal.set(0);
  }

  markRead(notificationUuid: string): Observable<void> {
    return this.http.put<ApiSuccess<{ uuid: string; isRead: boolean }>>(`${this.base}/${notificationUuid}/read`, {}).pipe(
      tap(() => {
        this.itemsSignal.update((items) => items.map((n) => (n.uuid === notificationUuid ? { ...n, isRead: true } : n)));
        this.unreadCountSignal.update((n) => Math.max(0, n - 1));
      }),
      map(() => undefined),
      catchError((err) => rethrowApiError(err)),
    );
  }

  markAllRead(): Observable<void> {
    return this.http.put<ApiSuccess<{ ok: boolean }>>(`${this.base}/read-all`, {}).pipe(
      tap(() => {
        this.itemsSignal.update((items) => items.map((n) => ({ ...n, isRead: true })));
        this.unreadCountSignal.set(0);
      }),
      map(() => undefined),
      catchError((err) => rethrowApiError(err)),
    );
  }
}
