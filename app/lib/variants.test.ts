/**
 * Tests for lib/variants.ts — getVariantUrl()
 */
import {describe, it, expect} from 'vitest';
import {getVariantUrl} from '~/lib/variants';

describe('getVariantUrl', () => {
  it('builds a basic product URL with no options', () => {
    const url = getVariantUrl({
      handle: 'cool-hoodie',
      pathname: '/products/cool-hoodie',
      searchParams: new URLSearchParams(),
      selectedOptions: [],
    });
    expect(url).toBe('/products/cool-hoodie');
  });

  it('appends selected options as query params', () => {
    const url = getVariantUrl({
      handle: 'cool-hoodie',
      pathname: '/products/cool-hoodie',
      searchParams: new URLSearchParams(),
      selectedOptions: [
        {name: 'Color', value: 'Black'},
        {name: 'Size', value: 'L'},
      ],
    });
    expect(url).toContain('Color=Black');
    expect(url).toContain('Size=L');
    expect(url).toMatch(/^\/products\/cool-hoodie\?/);
  });

  it('prefixes locale path when pathname starts with a locale segment', () => {
    const url = getVariantUrl({
      handle: 'cool-hoodie',
      pathname: '/en-gb/products/cool-hoodie',
      searchParams: new URLSearchParams(),
      selectedOptions: [],
    });
    expect(url).toMatch(/^\/en-gb\/products\/cool-hoodie/);
  });

  it('includes locale prefix with options', () => {
    const url = getVariantUrl({
      handle: 'tee',
      pathname: '/fr-fr/products/tee',
      searchParams: new URLSearchParams(),
      selectedOptions: [{name: 'Size', value: 'M'}],
    });
    expect(url).toContain('/fr-fr/products/tee');
    expect(url).toContain('Size=M');
  });

  it('works when selectedOptions is undefined', () => {
    const url = getVariantUrl({
      handle: 'item',
      pathname: '/products/item',
      searchParams: new URLSearchParams(),
      selectedOptions: undefined,
    });
    expect(url).toBe('/products/item');
  });

  it('merges pre-existing searchParams with selected options', () => {
    const params = new URLSearchParams({existing: 'param'});
    const url = getVariantUrl({
      handle: 'item',
      pathname: '/products/item',
      searchParams: params,
      selectedOptions: [{name: 'Color', value: 'Red'}],
    });
    expect(url).toContain('existing=param');
    expect(url).toContain('Color=Red');
  });
});
