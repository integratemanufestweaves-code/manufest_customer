/**
 * Raw shape from `GET /public/categories/list` (manufest_be's
 * `categories.api.js`) — note this route returns bare DB column names
 * (`image_url`, not `imageUrl`) unlike the `products` module's routes,
 * which all go through a `toPublic*()` camelCase transform. `CategoryService`
 * normalizes this to `Category` below; nothing outside that service should
 * ever see `image_url` directly.
 */
export interface CategoryApiRow {
  uuid: string;
  name: string;
  slug: string;
  image_url: string | null;
}

export interface Category {
  uuid: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}
