import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Generic placeholder for every route that has no backing manufest_be API
 * yet (or whose full page — auth, cart, wishlist, filtered browsing, etc.
 * — is explicitly out of scope for this first pass of the app). Same
 * pattern as manufest_seller's `placeholder.component` / `placeholder/`
 * feature: driven entirely by the route's own `data.pageTitle` /
 * `data.description`, so adding a new "coming soon" destination is just a
 * new route entry in app.routes.ts, never a new component.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);

  readonly pageTitle = (this.route.snapshot.data['pageTitle'] as string) || 'This page';
  readonly description =
    (this.route.snapshot.data['description'] as string) ||
    "We're still building this part of Manufest Weaves. Check back soon.";
}
