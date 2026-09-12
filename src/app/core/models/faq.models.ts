/**
 * Shapes for manufest_be's `faq` module (`src/modules/faq/faq.api.js`),
 * `publicRouter` only — mounted `/api/v1/public/faq/*`.
 */

export interface FaqCategoryApiRow {
  uuid: string;
  category_name: string;
  sort_order: number;
}

export interface FaqCategory {
  uuid: string;
  name: string;
  sortOrder: number;
}

export interface FaqItem {
  uuid: string;
  question: string;
  answer: string;
  category: { uuid: string; name: string };
}
