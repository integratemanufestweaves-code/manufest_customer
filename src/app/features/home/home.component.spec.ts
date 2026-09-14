import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';
import { ProductService } from '../../core/services/product.service';
import { environment } from '../../../environments/environment';

/**
 * Focuses on the media-proxy routing bug fixed this session: raw S3 URLs
 * 403 because the bucket is private, so every image binding on this page
 * must go through ProductService.mediaSrc() rather than a raw string.
 * Deliberately never calls fixture.detectChanges() — ngOnInit (and
 * therefore the listProducts()/listCategories() HTTP calls, and
 * ResponsiveBannerComponent's own child HTTP call) never fires, so these
 * assertions target field-initializer state and pure methods in isolation.
 */
describe('HomeComponent — media proxy routing', () => {
  let component: HomeComponent;
  const mediaBase = `${environment.apiBaseUrl}/public/products/media`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    component = TestBed.createComponent(HomeComponent).componentInstance;
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('spotlightImageSrc is routed through the /media proxy, not the raw S3 URL', () => {
    expect(component.spotlightImageSrc).toContain(`${mediaBase}?url=`);
    expect(component.spotlightImageSrc).not.toContain('s3.ap-south-1.amazonaws.com/product-media/images/site-content/spotlight');
  });

  it('growImageSrc is routed through the /media proxy, not the raw S3 URL', () => {
    expect(component.growImageSrc).toContain(`${mediaBase}?url=`);
    expect(component.growImageSrc).not.toContain('s3.ap-south-1.amazonaws.com/product-media/images/site-content/grow-business');
  });

  it('categoryImageSrc() delegates to ProductService.mediaSrc (same proxy every other image uses)', () => {
    const productService = TestBed.inject(ProductService);
    const spy = spyOn(productService, 'mediaSrc').and.callThrough();
    const raw = 'https://manufest-media-storage.s3.ap-south-1.amazonaws.com/product-media/images/categories/sarees.jpg';

    const result = component.categoryImageSrc(raw);

    expect(spy).toHaveBeenCalledWith(raw);
    expect(result).toBe(`${mediaBase}?url=${encodeURIComponent(raw)}`);
  });

  it('categoryImageSrc() returns null for a null image_url instead of an empty <img src>', () => {
    expect(component.categoryImageSrc(null)).toBeNull();
  });

  describe('categoryImageBucket', () => {
    it('matches "Blouses" case-insensitively', () => {
      expect(component.categoryImageBucket('BLOUSES')).toBe('category-blouses');
    });

    it('matches "Sarees"/"Saris" variants', () => {
      expect(component.categoryImageBucket('Sarees')).toBe('category-sarees');
      expect(component.categoryImageBucket('Designer Saris')).toBe('category-sarees');
    });

    it('matches dress material / fabric / raw', () => {
      expect(component.categoryImageBucket('Dress Materials')).toBe('category-dress-materials');
      expect(component.categoryImageBucket('Raw Silk Fabric')).toBe('category-dress-materials');
    });

    it('falls back to category-generic for an unrecognized name', () => {
      expect(component.categoryImageBucket('Jewellery')).toBe('category-generic');
    });
  });

  describe('tileImage', () => {
    it('produces a deterministic assets/tiles/<bucket>/<n>.webp path within the 1..10 range', () => {
      const path = component.tileImage('category-sarees');
      expect(path).toMatch(/^assets\/tiles\/category-sarees\/(?:[1-9]|10)\.webp$/);
    });

    it('returns the same image for the same bucket on repeated calls within one page load', () => {
      const first = component.tileImage('price-under-5k');
      const second = component.tileImage('price-under-5k');
      expect(first).toBe(second);
    });
  });

  describe('onCategoryImageError / brokenCategoryImages', () => {
    it('marks a category uuid as broken after an image load failure', () => {
      component.onCategoryImageError('cat-1');
      expect(component.brokenCategoryImages().has('cat-1')).toBeTrue();
    });
  });
});
