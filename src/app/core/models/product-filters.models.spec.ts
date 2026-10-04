import { PRICE_BANDS, priceRangeLabel } from './product-filters.models';

describe('PRICE_BANDS (listing sidebar + header "Shop by Price")', () => {
  it('offers exactly the four agreed bands, in order', () => {
    expect(PRICE_BANDS.map((b) => b.label)).toEqual(['Under ₹299', 'Under ₹1,000', 'Under ₹2,000', '₹3,000 and above']);
  });

  it('"Under" bands set only priceMax; the last band sets only priceMin', () => {
    expect(PRICE_BANDS.map((b) => [b.min, b.max])).toEqual([
      [null, 299],
      [null, 1000],
      [null, 2000],
      [3000, null],
    ]);
  });

  it('labels are unique (they are the @for track key)', () => {
    const labels = PRICE_BANDS.map((b) => b.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('priceRangeLabel (active-filter chip text)', () => {
  it('max only reads "Under ₹…"', () => {
    expect(priceRangeLabel(null, 299)).toBe('Under ₹299');
  });

  it('min only reads "₹… and above"', () => {
    expect(priceRangeLabel(3000, null)).toBe('₹3,000 and above');
  });

  it('both bounds read as a range (e.g. a hand-typed URL)', () => {
    expect(priceRangeLabel(500, 1000)).toBe('₹500 - ₹1,000');
  });
});
