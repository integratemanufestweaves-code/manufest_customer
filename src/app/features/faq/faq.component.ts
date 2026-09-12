import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { FaqService } from '../../core/services/faq.service';
import { FaqCategory, FaqItem } from '../../core/models/faq.models';

/**
 * `GET /public/faq/categories` + `/list?categoryUuid=&q=` (`faq.api.js`'s
 * `publicRouter`) — matches `ui_design/FAQ's.png`: sidebar categories +
 * search + an accordion list. `q` is a plain `LIKE` against `question`
 * server-side, so this is "starts/contains" matching, not fuzzy search.
 */
@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss',
})
export class FaqComponent implements OnInit {
  private readonly faqService = inject(FaqService);

  readonly categories = signal<FaqCategory[]>([]);
  readonly categoriesLoading = signal(true);

  readonly items = signal<FaqItem[]>([]);
  readonly itemsLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeCategoryUuid = signal<string | null>(null);
  readonly openItemUuid = signal<string | null>(null);
  searchTerm = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.faqService.listCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => this.categoriesLoading.set(false),
    });

    this.loadItems();
  }

  private loadItems(): void {
    this.itemsLoading.set(true);
    this.error.set(null);
    this.faqService.list({ categoryUuid: this.activeCategoryUuid(), q: this.searchTerm || null }).subscribe({
      next: (items) => {
        this.items.set(items);
        this.itemsLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Could not load FAQs right now.');
        this.itemsLoading.set(false);
      },
    });
  }

  selectCategory(categoryUuid: string | null): void {
    this.activeCategoryUuid.set(categoryUuid);
    this.loadItems();
  }

  onSearchInput(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.loadItems(), 300);
  }

  toggleItem(uuid: string): void {
    this.openItemUuid.set(this.openItemUuid() === uuid ? null : uuid);
  }
}
