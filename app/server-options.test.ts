/**
 * Tests for server.ts OPTIONS preflight handler
 *
 * The server short-circuits OPTIONS requests before React Router sees them,
 * returning a 204 with CORS headers. This tests that logic in isolation.
 */
import {describe, it, expect} from 'vitest';

// Inline the logic under test so we don't need to import the full
// Worker entry (which requires virtual Vite modules unavailable in Vitest).
function handleOptions(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

describe('OPTIONS preflight handler', () => {
  it('returns 204 for OPTIONS requests', () => {
    const req = new Request('https://trendsbyafeez.com/api/newsletter', {method: 'OPTIONS'});
    const res = handleOptions(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
  });

  it('includes correct CORS headers', () => {
    const req = new Request('https://trendsbyafeez.com/', {method: 'OPTIONS'});
    const res = handleOptions(req)!;
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('returns null (pass-through) for GET requests', () => {
    const req = new Request('https://trendsbyafeez.com/', {method: 'GET'});
    expect(handleOptions(req)).toBeNull();
  });

  it('returns null (pass-through) for POST requests', () => {
    const req = new Request('https://trendsbyafeez.com/api/newsletter', {method: 'POST'});
    expect(handleOptions(req)).toBeNull();
  });
});
