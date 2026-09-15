import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../core/services/notification.service';
import { CustomerNotification } from '../../core/models/notification.models';

/**
 * `GET/PUT /customer/notifications*` (`customerNotifications.api.js`) —
 * replaces the old `ComingSoonComponent` stub this route used to be (see
 * app.routes.ts's header comment, which used to list this as one of the
 * "genuinely blocked, no backend endpoint at all" routes — it isn't
 * anymore). Today's only notification type is `BACK_IN_STOCK`, fired from
 * the wishlist page's "Notify me" button on an out-of-stock item.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly items = this.notificationService.items;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly markingAllRead = signal(false);

  ngOnInit(): void {
    this.notificationService.refresh();
    this.loading.set(false);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  open(notification: CustomerNotification): void {
    if (!notification.isRead) {
      this.notificationService.markRead(notification.uuid).subscribe();
    }
    if (notification.linkUrl) {
      this.router.navigateByUrl(notification.linkUrl);
    }
  }

  markAllRead(): void {
    this.markingAllRead.set(true);
    this.error.set(null);
    this.notificationService.markAllRead().subscribe({
      next: () => this.markingAllRead.set(false),
      error: (err) => {
        this.error.set(err?.message || 'Could not mark everything as read.');
        this.markingAllRead.set(false);
      },
    });
  }
}
