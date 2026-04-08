import type {Route} from './+types/api.$version.[graphql.json]';

const ALLOWED_API_VERSIONS = /^(\d{4}-\d{2}|unstable|release-candidate)$/;

export async function action({params, context, request}: Route.ActionArgs) {
  const {version} = params;

  if (!version || !ALLOWED_API_VERSIONS.test(version)) {
    return new Response('Invalid API version', {status: 400});
  }

  const response = await fetch(
    `https://${context.env.PUBLIC_CHECKOUT_DOMAIN}/api/${version}/graphql.json`,
    {
      method: 'POST',
      body: request.body,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'X-Shopify-Storefront-Access-Token':
          request.headers.get('X-Shopify-Storefront-Access-Token') || '',
      },
    },
  );

  return new Response(response.body, {headers: new Headers(response.headers)});
}
