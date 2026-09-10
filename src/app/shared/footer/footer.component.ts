import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  path: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/**
 * Footer matches `design-reference/user/home/home-01-desktop.png`'s
 * bottom band (About us / Shop / Sell / Help columns + socials). Every
 * link routes to the shared "coming soon" page — none of these are backed
 * by a real API/page yet (see app.routes.ts).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
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
        { label: 'Sell on Manufest', path: '/sell-on-manufest' },
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

  readonly socials: FooterLink[] = [
    { label: 'Instagram', path: '/social' },
    { label: 'Facebook', path: '/social' },
    { label: 'YouTube', path: '/social' },
  ];
}
