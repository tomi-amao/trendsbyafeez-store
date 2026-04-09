/**
 * Tests for lib/orderFilters.ts — buildOrderSearchQuery() & parseOrderFilters()
 */
import {describe, it, expect} from 'vitest';
import {buildOrderSearchQuery, parseOrderFilters} from '~/lib/orderFilters';

describe('buildOrderSearchQuery', () => {
  it('returns undefined when no filters provided', () => {
    expect(buildOrderSearchQuery({})).toBeUndefined();
  });

  it('builds a name-only query', () => {
    expect(buildOrderSearchQuery({name: '1001'})).toBe('name:1001');
  });

  it('strips leading # from order name', () => {
    expect(buildOrderSearchQuery({name: '#1001'})).toBe('name:1001');
  });

  it('builds a confirmationNumber-only query', () => {
    expect(buildOrderSearchQuery({confirmationNumber: 'ABC123'})).toBe(
      'confirmation_number:ABC123',
    );
  });

  it('combines name and confirmationNumber with AND', () => {
    expect(
      buildOrderSearchQuery({name: '1001', confirmationNumber: 'ABC123'}),
    ).toBe('name:1001 AND confirmation_number:ABC123');
  });

  it('sanitizes injection characters from name', () => {
    // Characters outside alphanumeric/dash/underscore should be stripped
    const result = buildOrderSearchQuery({name: '1001; DROP TABLE orders'});
    expect(result).toBe('name:1001DROPTABLEorders');
  });

  it('sanitizes injection characters from confirmationNumber', () => {
    const result = buildOrderSearchQuery({confirmationNumber: 'ABC<script>'});
    expect(result).toBe('confirmation_number:ABCscript');
  });

  it('returns undefined when name sanitizes to empty string', () => {
    const result = buildOrderSearchQuery({name: '!!!'});
    expect(result).toBeUndefined();
  });

  it('trims whitespace from name', () => {
    expect(buildOrderSearchQuery({name: '  1001  '})).toBe('name:1001');
  });
});

describe('parseOrderFilters', () => {
  function params(obj: Record<string, string>) {
    return new URLSearchParams(obj);
  }

  it('returns empty object for empty params', () => {
    expect(parseOrderFilters(params({}))).toEqual({});
  });

  it('parses name param', () => {
    expect(parseOrderFilters(params({name: '1001'}))).toEqual({name: '1001'});
  });

  it('parses confirmation_number param', () => {
    expect(
      parseOrderFilters(params({confirmation_number: 'ABC'})),
    ).toEqual({confirmationNumber: 'ABC'});
  });

  it('parses both params together', () => {
    expect(
      parseOrderFilters(params({name: '1001', confirmation_number: 'XYZ'})),
    ).toEqual({name: '1001', confirmationNumber: 'XYZ'});
  });

  it('ignores unrelated params', () => {
    expect(
      parseOrderFilters(params({foo: 'bar', name: '5'})),
    ).toEqual({name: '5'});
  });
});
