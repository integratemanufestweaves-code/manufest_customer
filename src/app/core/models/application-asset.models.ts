/**
 * Raw shape from `GET /public/application-assets/active` (manufest_be's
 * applicationAssets.api.js) — already camelCased by that route's
 * `toPublicAsset()`, unlike categories.api.js's bare-column-name response.
 * `files` is keyed by breakpoint ('default' is the only key guaranteed to
 * be present — see ResponsiveBannerComponent for how a missing
 * mobile/tablet/laptop/monitor key falls back to it).
 */
export type AssetBreakpoint = 'default' | 'mobile' | 'tablet' | 'laptop' | 'monitor';

export interface ApplicationAssetFile {
  uuid: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export type ApplicationAssetFilesMap = Partial<Record<AssetBreakpoint, ApplicationAssetFile>>;

export interface ApplicationAsset {
  uuid: string;
  category: string;
  placementKey: string;
  title: string;
  occasion: string | null;
  linkUrl: string | null;
  sortOrder: number;
  files: ApplicationAssetFilesMap;
}
