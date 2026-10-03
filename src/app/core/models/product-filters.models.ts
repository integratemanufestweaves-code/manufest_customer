import type { ListProductsOptions } from '../services/product.service';

/**
 * `GET /public/products/filters` (manufest_be, added 2026-10-01) — every
 * storefront filter's options with live product counts. Backs the header's
 * nav filter menus and search suggestions, and the listing page's filter
 * sidebar.
 *
 * Attribute values (fabric, material, zari type…) are all returned,
 * including ones with no products yet (`productCount` 0). Origins are
 * seller districts and colors are variant colour names, both grouped
 * case-insensitively server-side: `value` is the normalized key to send
 * back as a filter, `name` the display label. Brands are sellers.
 */
export interface AttributeFilterOption {
  uuid: string;
  name: string;
  productCount: number;
}

export interface KeyedFilterOption {
  value: string;
  name: string;
  productCount: number;
}

export interface ColorFilterOption extends KeyedFilterOption {
  hex: string;
}

export interface ProductFilters {
  categories: AttributeFilterOption[];
  brands: AttributeFilterOption[];
  colors: ColorFilterOption[];
  fabricPurities: AttributeFilterOption[];
  materials: AttributeFilterOption[];
  zariColors: AttributeFilterOption[];
  zariTypes: AttributeFilterOption[];
  borderTypes: AttributeFilterOption[];
  occasions: AttributeFilterOption[];
  fabrics: AttributeFilterOption[];
  weaves: AttributeFilterOption[];
  origins: KeyedFilterOption[];
  blouse: { with: number; without: number };
  discounts: Array<{ min: number; productCount: number }>;
}

/** Multi-select sidebar groups. Each key is also the listing page's query
 * param (`?fabric=<uuid>,<uuid>`). */
export type FacetKey = 'brand' | 'color' | 'purity' | 'material' | 'zariColor' | 'zariType' | 'border' | 'occasion' | 'fabric' | 'weave' | 'origin';

export interface FacetOption {
  /** What goes in the URL / API filter: an attribute or seller uuid, or a
   * normalized origin/colour key. */
  value: string;
  name: string;
  productCount: number;
  /** Colour swatch, colours only. */
  hex?: string;
}

type MultiValueApiKey = 'sellerUuids' | 'colors' | 'fabricPurityUuids' | 'materialUuids' | 'zariColorUuids' | 'zariTypeUuids' | 'borderTypeUuids' | 'occasionUuids' | 'fabricUuids' | 'weaveUuids' | 'origins';

export interface FacetDefinition {
  facet: FacetKey;
  /** Sidebar group heading / chip prefix / breadcrumb label. */
  label: string;
  apiKey: MultiValueApiKey & keyof ListProductsOptions;
  options: (filters: ProductFilters) => FacetOption[];
}

const byUuid = (list: AttributeFilterOption[]): FacetOption[] => list.map((o) => ({ value: o.uuid, name: o.name, productCount: o.productCount }));

/** In sidebar order (matches the design mock's filter column). */
export const FACETS: FacetDefinition[] = [
  { facet: 'brand', label: 'Brand', apiKey: 'sellerUuids', options: (f) => byUuid(f.brands) },
  { facet: 'color', label: 'Colours', apiKey: 'colors', options: (f) => f.colors.map((c) => ({ ...c })) },
  { facet: 'purity', label: 'Fabric Purity', apiKey: 'fabricPurityUuids', options: (f) => byUuid(f.fabricPurities) },
  { facet: 'material', label: 'Material', apiKey: 'materialUuids', options: (f) => byUuid(f.materials) },
  { facet: 'zariColor', label: 'Zari Colour', apiKey: 'zariColorUuids', options: (f) => byUuid(f.zariColors) },
  { facet: 'zariType', label: 'Zari Type', apiKey: 'zariTypeUuids', options: (f) => byUuid(f.zariTypes) },
  { facet: 'border', label: 'Border Type', apiKey: 'borderTypeUuids', options: (f) => byUuid(f.borderTypes) },
  { facet: 'occasion', label: 'Occasion', apiKey: 'occasionUuids', options: (f) => byUuid(f.occasions) },
  { facet: 'fabric', label: 'Fabric', apiKey: 'fabricUuids', options: (f) => byUuid(f.fabrics) },
  { facet: 'weave', label: 'Weave', apiKey: 'weaveUuids', options: (f) => byUuid(f.weaves) },
  { facet: 'origin', label: 'Origin', apiKey: 'origins', options: (f) => f.origins.map((o) => ({ ...o })) },
];

export function facetDefinition(facet: FacetKey): FacetDefinition {
  return FACETS.find((f) => f.facet === facet)!;
}

export function facetOptions(filters: ProductFilters, facet: FacetKey): FacetOption[] {
  return facetDefinition(facet).options(filters);
}
