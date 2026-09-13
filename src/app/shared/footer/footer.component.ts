import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BRAND_ASSETS } from '../../core/constants/brand-assets';

interface FooterLink {
  label: string;
  path: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  label: string;
  path: string;
  icon: 'instagram' | 'facebook' | 'youtube' | 'threads';
}

/**
 * Footer matches `ui_design/Home Page.png`'s bottom band exactly, at the
 * user's explicit request (2026-09-10) — a two-tone layout, not the single
 * flat-maroon band this used to be:
 * - `.footer__about` — cream (`--color-bg-tint`) panel: the real logo mark
 *   (same asset the header uses) stacked above the "Manufest" wordmark and
 *   a tagline, then icon-led contact rows.
 * - `.footer__links` — a photo-backed panel (see `footer.component.scss`'s
 *   `background-image` comment for exactly where to drop the real photo)
 *   holding the Shop/Sell/Help columns, with social icons placed directly
 *   under the Help column's links — not a separate full-width bottom bar,
 *   which the design doesn't have at all. Every link routes to the shared
 *   "coming soon" page — none of these are backed by a real API/page yet
 *   (see app.routes.ts).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly logoMark = BRAND_ASSETS.logoMark;

  readonly columns: FooterColumn[] = [
    {
      title: 'Shop',
      links: [
        { label: 'Kanchivaram Silk Saree', path: '/new-arrivals' },
        { label: 'Raw Silk Sarees', path: '/fabric' },
        { label: 'Soft Silk Sarees', path: '/fabric' },
        { label: 'Tissue Sarees', path: '/fabric' },
      ],
    },
    {
      title: 'Sell',
      links: [
        { label: 'Sell on Manufest Weaves', path: '/sell-on-manufest' },
        { label: 'Our Manufacturers', path: '/manufacturers' },
        { label: 'Affiliates & Creators', path: '/affiliates' },
      ],
    },
    {
      title: 'Help',
      links: [
        { label: "FAQ's", path: '/faq' },
        { label: 'Help Center', path: '/help-center' },
        { label: 'Privacy Settings', path: '/privacy' },
      ],
    },
  ];

  readonly socials: SocialLink[] = [
    { label: 'Instagram', path: '/social', icon: 'instagram' },
    { label: 'Facebook', path: '/social', icon: 'facebook' },
    { label: 'YouTube', path: '/social', icon: 'youtube' },
    { label: 'Threads', path: '/social', icon: 'threads' },
  ];
}
