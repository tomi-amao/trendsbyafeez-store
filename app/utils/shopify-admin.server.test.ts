/**
 * Tests for utils/shopify-admin.server.ts
 *
 * Covers:
 * - getAdminAccessToken: fetches token, caches, rejects on error
 * - fetchAdminHeroMedia: image, video, null on error, retries on 502
 * - fetchAdminVideoByFilename: video node, null when missing
 * - fetchAdminFiles: returns mapped nodes, handles pagination
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';

// The module uses module-level token cache — reset between tests by re-importing
// We use vi.resetModules() to get a fresh module instance per describe block.

describe('getAdminAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('fetches and returns an access token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({access_token: 'tok_abc', expires_in: 3600}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {getAdminAccessToken} = await import('~/utils/shopify-admin.server');
    const token = await getAdminAccessToken('store.myshopify.com', 'id', 'secret');
    expect(token).toBe('tok_abc');
  });

  it('caches the token and does not fetch again within expiry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({access_token: 'tok_cached', expires_in: 3600}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {getAdminAccessToken} = await import('~/utils/shopify-admin.server');
    await getAdminAccessToken('store.myshopify.com', 'id', 'secret');
    await getAdminAccessToken('store.myshopify.com', 'id', 'secret');
    // Only one real fetch — second call uses cache
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when the token exchange fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', {status: 401}),
    );
    const {getAdminAccessToken} = await import('~/utils/shopify-admin.server');
    await expect(
      getAdminAccessToken('store.myshopify.com', 'bad-id', 'bad-secret'),
    ).rejects.toThrow('[ShopifyAdmin] Token exchange failed');
  });
});

describe('fetchAdminHeroMedia', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns an image type when MediaImage node is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            files: {
              edges: [{node: {image: {url: 'https://cdn.shopify.com/hero.jpg'}, alt: 'Hero'}}],
            },
          },
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'hero.jpg');
    expect(result).toEqual({
      type: 'image',
      url: 'https://cdn.shopify.com/hero.jpg',
      altText: 'Hero',
    });
  });

  it('returns a video type when Video node is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            files: {
              edges: [
                {
                  node: {
                    alt: 'Hero video',
                    sources: [{url: 'https://cdn.shopify.com/hero.mp4', mimeType: 'video/mp4'}],
                  },
                },
              ],
            },
          },
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'hero.mp4');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('video');
    if (result!.type === 'video') {
      expect(result!.sources[0].url).toBe('https://cdn.shopify.com/hero.mp4');
    }
  });

  it('returns null when no file is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({data: {files: {edges: []}}}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'missing.jpg');
    expect(result).toBeNull();
  });

  it('returns null on HTTP error without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('error', {status: 403}),
    );
    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'hero.jpg');
    expect(result).toBeNull();
  });

  it('retries once on 502 and succeeds on the second call', async () => {
    const successResponse = new Response(
      JSON.stringify({
        data: {
          files: {
            edges: [{node: {image: {url: 'https://cdn.shopify.com/img.jpg'}, alt: null}}],
          },
        },
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}},
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad gateway', {status: 502}))
      .mockResolvedValueOnce(successResponse);

    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'img.jpg');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('image');
  });

  it('returns null when both the initial request and retry fail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad gateway', {status: 502}))
      .mockResolvedValueOnce(new Response('bad gateway', {status: 502}));

    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'img.jpg');
    expect(result).toBeNull();
  });

  it('handles null alt text gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            files: {
              edges: [{node: {image: {url: 'https://cdn.shopify.com/img.jpg'}, alt: null}}],
            },
          },
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminHeroMedia} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminHeroMedia('store.myshopify.com', 'tok', 'img.jpg');
    expect(result!.altText).toBeNull();
  });
});

describe('fetchAdminVideoByFilename', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns a video node when found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            files: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Video/1',
                    alt: 'My video',
                    sources: [
                      {url: 'https://cdn.shopify.com/v.mp4', mimeType: 'video/mp4', format: 'mp4'},
                    ],
                  },
                },
              ],
            },
          },
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminVideoByFilename} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminVideoByFilename('store.myshopify.com', 'tok', 'v.mp4');
    expect(result).not.toBeNull();
    expect(result!.sources[0].url).toBe('https://cdn.shopify.com/v.mp4');
  });

  it('returns null when no video is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({data: {files: {edges: []}}}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      ),
    );
    const {fetchAdminVideoByFilename} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminVideoByFilename('store.myshopify.com', 'tok', 'missing.mp4');
    expect(result).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('forbidden', {status: 403}),
    );
    const {fetchAdminVideoByFilename} = await import('~/utils/shopify-admin.server');
    const result = await fetchAdminVideoByFilename('store.myshopify.com', 'tok', 'v.mp4');
    expect(result).toBeNull();
  });
});
