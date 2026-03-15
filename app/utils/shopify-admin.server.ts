/**
 * Shopify Admin API utility — server-side only.
 *
 * Provides a reusable way to obtain a short-lived Admin API access token
 * via the OAuth 2.0 client credentials grant, and helpers for common
 * Admin API operations (e.g. fetching files from Shopify Files).
 *
 * Required env vars:
 *   SHOPIFY_CLIENT_ID      — from the Shopify dev-dashboard custom app
 *   SHOPIFY_CLIENT_SECRET  — from the Shopify dev-dashboard custom app
 *   PUBLIC_STORE_DOMAIN    — e.g. your-store.myshopify.com
 */

/* ── Token cache (module-level, shared across requests in same process) ── */
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Exchange client credentials for an Admin API access token.
 * Results are cached in memory for the lifetime of the token (minus 60 s buffer).
 */
export async function getAdminAccessToken(
  storeDomain: string,
  clientId: string,
  clientSecret: string,
  debugMode = false,
): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 60_000) {
    if (debugMode)
      console.log(
        '[ShopifyAdmin] Using cached token (expires in',
        Math.round((_tokenExpiresAt - Date.now()) / 1000),
        's)',
      );
    return _cachedToken;
  }

  if (debugMode)
    console.log('[ShopifyAdmin] Exchanging client credentials for admin token…');

  const res = await fetch(
    `https://${storeDomain}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[ShopifyAdmin] Token exchange failed (HTTP ${res.status}): ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  _cachedToken = data.access_token;
  _tokenExpiresAt = Date.now() + data.expires_in * 1000;

  if (debugMode)
    console.log(
      '[ShopifyAdmin] New token obtained — scope:',
      data.scope,
      '| expires_in:',
      data.expires_in,
      's',
    );

  return _cachedToken;
}

/** Shape of a single file node returned by the Admin Files API. */
export interface AdminFileNode {
  id: string;
  alt: string | null;
  image: {
    url: string;
    width: number | null;
    height: number | null;
  } | null;
}

/** Shape of a video source returned by the Admin Files API. */
export interface AdminVideoSource {
  url: string;
  mimeType: string | null;
  format: string | null;
}

/** Shape of a Video file node from the Admin Files API. */
export interface AdminVideoNode {
  id: string;
  alt: string | null;
  sources: AdminVideoSource[];
}

/**
 * Fetch a single Video file from Shopify by filename prefix.
 * Returns the first matching video node, or null if not found.
 */
export async function fetchAdminVideoByFilename(
  storeDomain: string,
  accessToken: string,
  filenamePrefix: string,
): Promise<AdminVideoNode | null> {
  const apiUrl = `https://${storeDomain}/admin/api/2024-04/graphql.json`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query: `
        query AdminVideo($query: String) {
          files(first: 1, query: $query) {
            edges {
              node {
                ... on Video {
                  id
                  alt
                  sources {
                    url
                    mimeType
                    format
                  }
                }
              }
            }
          }
        }
      `,
      variables: {query: `filename:${filenamePrefix}`},
    }),
  });

  if (!res.ok) {
    console.error(`[ShopifyAdmin] Video fetch failed (HTTP ${res.status})`);
    return null;
  }

  const json = (await res.json()) as any;
  const node = json?.data?.files?.edges?.[0]?.node;

  if (!node?.sources) return null;

  return {
    id: node.id as string,
    alt: (node.alt as string | null) ?? null,
    sources: (node.sources as any[]).map((s) => ({
      url: s.url as string,
      mimeType: (s.mimeType as string | null) ?? null,
      format: (s.format as string | null) ?? null,
    })),
  };
}

/**
 * Fetch all MediaImage files from Shopify whose filenames match
 * the optional `filenamePrefix` filter (default: fetch all).
 *
 * Returns up to `limit` files (max 250 per API page; set higher to paginate).
 */
export async function fetchAdminFiles(
  storeDomain: string,
  accessToken: string,
  options: {filenamePrefix?: string; limit?: number; debugMode?: boolean} = {},
): Promise<AdminFileNode[]> {
  const {filenamePrefix = '', limit = 250, debugMode = false} = options;

  const apiUrl = `https://${storeDomain}/admin/api/2024-04/graphql.json`;
  const query =
    filenamePrefix
      ? `filename:${filenamePrefix}`
      : undefined;

  let allFiles: AdminFileNode[] = [];
  let cursor: string | null = null;

  // Paginate until we have `limit` files or exhaust the list.
  do {
    const variables: Record<string, unknown> = {first: Math.min(limit - allFiles.length, 250)};
    if (cursor) variables.after = cursor;
    if (query) variables.query = query;

    if (debugMode)
      console.log('[ShopifyAdmin] Fetching files page — cursor:', cursor ?? '(start)');

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          query AdminFiles($first: Int!, $after: String, $query: String) {
            files(first: $first, after: $after, query: $query) {
              edges {
                node {
                  ... on MediaImage {
                    id
                    alt
                    image {
                      url
                      width
                      height
                    }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
        variables,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `[ShopifyAdmin] Files API request failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as any;

    if (json?.errors?.length) {
      throw new Error(
        `[ShopifyAdmin] GraphQL errors: ${JSON.stringify(json.errors)}`,
      );
    }

    const edges: any[] = json?.data?.files?.edges ?? [];
    const mediaImages: AdminFileNode[] = edges
      .filter((e: any) => e.node?.image)
      .map((e: any) => ({
        id: e.node.id as string,
        alt: (e.node.alt as string | null) ?? null,
        image: {
          url: e.node.image.url as string,
          width: (e.node.image.width as number | null) ?? null,
          height: (e.node.image.height as number | null) ?? null,
        },
      }));

    allFiles = allFiles.concat(mediaImages);

    const pageInfo = json?.data?.files?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;

    if (debugMode)
      console.log(
        '[ShopifyAdmin] Page returned',
        mediaImages.length,
        'images | total so far:',
        allFiles.length,
        '| hasNextPage:',
        !!cursor,
      );
  } while (cursor && allFiles.length < limit);

  return allFiles;
}
