/**
 * Tests for lib/i18n.ts — getLocaleFromRequest()
 */
import {describe, it, expect} from 'vitest';
import {getLocaleFromRequest} from '~/lib/i18n';

function req(path: string) {
  return new Request(`https://trendsbyafeez.com${path}`);
}

describe('getLocaleFromRequest', () => {
  it('defaults to EN-US with empty pathPrefix for root path', () => {
    const locale = getLocaleFromRequest(req('/'));
    expect(locale).toEqual({language: 'EN', country: 'US', pathPrefix: ''});
  });

  it('parses en-US locale from path', () => {
    const locale = getLocaleFromRequest(req('/en-us/products'));
    expect(locale.language).toBe('EN');
    expect(locale.country).toBe('US');
    // The implementation uppercases the path segment then stores it as pathPrefix
    expect(locale.pathPrefix).toBe('/EN-US');
  });

  it('parses fr-FR locale from path', () => {
    const locale = getLocaleFromRequest(req('/fr-fr/collections'));
    expect(locale.language).toBe('FR');
    expect(locale.country).toBe('FR');
    expect(locale.pathPrefix).toBe('/FR-FR');
  });

  it('parses en-GB locale from path', () => {
    const locale = getLocaleFromRequest(req('/en-gb/'));
    expect(locale.language).toBe('EN');
    expect(locale.country).toBe('GB');
    expect(locale.pathPrefix).toBe('/EN-GB');
  });

  it('does not treat a normal path segment as a locale', () => {
    const locale = getLocaleFromRequest(req('/products/my-hoodie'));
    expect(locale.language).toBe('EN');
    expect(locale.country).toBe('US');
    expect(locale.pathPrefix).toBe('');
  });

  it('does not treat a 3-char segment as a locale', () => {
    const locale = getLocaleFromRequest(req('/eng-usa/products'));
    expect(locale.pathPrefix).toBe('');
  });
});
