/**
 * Tests for /api/newsletter action
 *
 * The action:
 * - Rejects non-POST methods with 405
 * - Validates email format with 400
 * - Soft-succeeds (200) when env vars are missing
 * - Calls Mailchimp and returns success on 2xx
 * - Returns already-subscribed message on Member Exists
 * - Surfaces Mailchimp's detail message on 4xx JSON errors
 * - Returns generic 500 when Mailchimp returns non-JSON (HTML gateway error)
 * - Returns generic 500 on network errors
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {action} from '~/routes/api.newsletter';

// React Router's data() returns DataWithResponseInit, not a standard Response.
// Mock it to return a real Response so assertions can use .status and .json().
vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>();
  return {
    ...mod,
    data: (d: any, init?: ResponseInit | number) => {
      const status =
        typeof init === 'number' ? init : (init as ResponseInit)?.status ?? 200;
      return new Response(JSON.stringify(d), {
        status,
        headers: {'Content-Type': 'application/json'},
      });
    },
  };
});

/* ── helpers ──────────────────────────────────────────────────────────── */

function makeRequest(
  method: string,
  fields: Record<string, string> = {},
): Request {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('http://localhost/api/newsletter', {method, body});
}

function makeContext(
  env: Record<string, string | undefined> = {},
): {env: Record<string, string | undefined>} {
  return {env};
}

const VALID_ENV = {
  MAILCHIMP_API_KEY: 'testkey-us21',
  MAILCHIMP_AUDIENCE_ID: 'abc123',
};

/* ── tests ────────────────────────────────────────────────────────────── */

describe('api.newsletter action', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Method validation ────────────────────────────────────────────────

  it('returns 405 for GET requests', async () => {
    const req = new Request('http://localhost/api/newsletter', {method: 'GET'});
    const res = await action({request: req, context: makeContext(), params: {}});
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/method not allowed/i);
  });

  it('returns 405 for PUT requests', async () => {
    const req = makeRequest('PUT', {email: 'a@b.com'});
    const res = await action({request: req, context: makeContext(), params: {}});
    expect(res.status).toBe(405);
  });

  // ── Email validation ─────────────────────────────────────────────────

  it.each([
    ['empty string', ''],
    ['missing @', 'notanemail'],
    ['missing domain', 'user@'],
    ['missing tld', 'user@domain'],
    ['only whitespace', '   '],
  ])('returns 400 for invalid email: %s', async (_, email) => {
    const req = makeRequest('POST', {email});
    const res = await action({request: req, context: makeContext(), params: {}});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/valid email/i);
  });

  it('normalises email to lowercase before sending', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({id: 'x'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    );

    const req = makeRequest('POST', {email: 'User@Example.COM'});
    await action({request: req, context: makeContext(VALID_ENV), params: {}});

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody.email_address).toBe('user@example.com');
  });

  // ── Missing env vars ─────────────────────────────────────────────────

  it('returns success:true when MAILCHIMP_API_KEY is missing (no fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const req = makeRequest('POST', {email: 'test@example.com'});
    const res = await action({
      request: req,
      context: makeContext({MAILCHIMP_AUDIENCE_ID: 'abc'}),
      params: {},
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns success:true when MAILCHIMP_AUDIENCE_ID is missing (no fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const req = makeRequest('POST', {email: 'test@example.com'});
    const res = await action({
      request: req,
      context: makeContext({MAILCHIMP_API_KEY: 'key-us21'}),
      params: {},
    });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── Mailchimp success ────────────────────────────────────────────────

  it('returns success:true when Mailchimp responds 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"id":"sub_001"}', {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    );

    const req = makeRequest('POST', {email: 'new@example.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('calls the correct Mailchimp datacenter URL derived from the API key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}}),
    );

    const req = makeRequest('POST', {email: 'a@b.com'});
    await action({
      request: req,
      context: makeContext({MAILCHIMP_API_KEY: 'mykey-eu1', MAILCHIMP_AUDIENCE_ID: 'list1'}),
      params: {},
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('eu1.api.mailchimp.com');
    expect(url).toContain('/lists/list1/members');
  });

  it('sends tags when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}}),
    );

    const req = makeRequest('POST', {email: 'a@b.com', tags: 'TBA SIGN UPS, website'});
    await action({request: req, context: makeContext(VALID_ENV), params: {}});

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.tags).toEqual(['TBA SIGN UPS', 'website']);
  });

  it('sends an empty tags array when no tags provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}}),
    );

    const req = makeRequest('POST', {email: 'a@b.com'});
    await action({request: req, context: makeContext(VALID_ENV), params: {}});

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.tags).toEqual([]);
  });

  // ── Mailchimp error responses ────────────────────────────────────────

  it('returns already-subscribed message when Mailchimp returns Member Exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({title: 'Member Exists', detail: 'already on list'}),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      ),
    );

    const req = makeRequest('POST', {email: 'existing@example.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/already subscribed/i);
  });

  it('surfaces Mailchimp detail message on 4xx validation errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Invalid Resource',
          detail: 'fake@fake.con looks fake or invalid, please enter a real email address.',
        }),
        {status: 400, headers: {'Content-Type': 'application/problem+json; charset=utf-8'}},
      ),
    );

    const req = makeRequest('POST', {email: 'fake@fake.con'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('looks fake or invalid');
  });

  it('falls back to generic message when Mailchimp detail is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({title: 'Some Unknown Error'}),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      ),
    );

    const req = makeRequest('POST', {email: 'a@b.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/something went wrong/i);
  });

  // ── Non-JSON (HTML gateway) response ─────────────────────────────────

  it('returns 500 without crashing when Mailchimp returns HTML (502 gateway)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<HTML><HEAD><TITLE>502 Bad Gateway</TITLE></HEAD></HTML>', {
        status: 502,
        headers: {'Content-Type': 'text/html'},
      }),
    );

    const req = makeRequest('POST', {email: 'a@b.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/something went wrong/i);
  });

  it('accepts application/problem+json as parseable JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({title: 'Invalid Resource', detail: 'Please provide a valid email address.'}),
        {status: 400, headers: {'Content-Type': 'application/problem+json; charset=utf-8'}},
      ),
    );

    const req = makeRequest('POST', {email: 'a@b.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    const json = await res.json();
    // Should NOT hit the HTML guard — should surface the detail
    expect(json.error).toMatch(/valid email/i);
  });

  // ── Network failure ───────────────────────────────────────────────────

  it('returns 500 gracefully on fetch network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const req = makeRequest('POST', {email: 'a@b.com'});
    const res = await action({request: req, context: makeContext(VALID_ENV), params: {}});
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
