/**
 * Tests for lib/search.ts — urlWithTrackingParams() & getEmptyPredictiveSearchResult()
 */
import {describe, it, expect} from 'vitest';
import {urlWithTrackingParams, getEmptyPredictiveSearchResult} from '~/lib/search';

describe('urlWithTrackingParams', () => {
  it('builds a URL with a search term', () => {
    const url = urlWithTrackingParams({
      baseUrl: 'https://example.com/search',
      term: 'hoodie',
    });
    expect(url).toContain('q=hoodie');
    expect(url).toMatch(/^https:\/\/example\.com\/search\?/);
  });

  it('encodes the search term (double-encodes via encodeURIComponent + URLSearchParams)', () => {
    const url = urlWithTrackingParams({
      baseUrl: 'https://example.com/search',
      term: 'black hoodie',
    });
    // urlWithTrackingParams calls encodeURIComponent(term) then passes to URLSearchParams
    // which percent-encodes the % character itself, resulting in %2520 for a space.
    expect(url).toContain('q=black%2520hoodie');
  });

  it('appends tracking params after the main query', () => {
    const url = urlWithTrackingParams({
      baseUrl: 'https://example.com/search',
      term: 'tee',
      trackingParams: 'utm_source=shopify',
    });
    expect(url).toContain('utm_source=shopify');
    expect(url).toContain('q=tee');
  });

  it('includes extra params', () => {
    const url = urlWithTrackingParams({
      baseUrl: 'https://example.com/search',
      term: 'cap',
      params: {sort: 'price-asc'},
    });
    expect(url).toContain('sort=price-asc');
    expect(url).toContain('q=cap');
  });

  it('works with no tracking params or extra params', () => {
    const url = urlWithTrackingParams({
      baseUrl: '/search',
      term: 'test',
    });
    expect(url).toBe('/search?q=test');
  });
});

describe('getEmptyPredictiveSearchResult', () => {
  it('returns a result with zero total', () => {
    const result = getEmptyPredictiveSearchResult();
    expect(result.total).toBe(0);
  });

  it('returns empty arrays for all item categories', () => {
    const {items} = getEmptyPredictiveSearchResult();
    expect(items.articles).toEqual([]);
    expect(items.collections).toEqual([]);
    expect(items.products).toEqual([]);
    expect(items.pages).toEqual([]);
    expect(items.queries).toEqual([]);
  });
});
