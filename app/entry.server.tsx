import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    connectSrc: [
      'https://cdn.jsdelivr.net',
      'https://lottie.host',
      'https://unpkg.com',
    ],
    // Mirrors Hydrogen's defaultSrc origins so the explicit script-src
    // directive doesn't drop any CDN domains that were previously covered
    // by the default-src fallback. 'wasm-unsafe-eval' is required for
    // WebAssembly.instantiateStreaming (used by @lottiefiles/dotlottie-web).
    scriptSrc: [
      "'self'",
      "'wasm-unsafe-eval'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://cdn.jsdelivr.net',
    ],
    workerSrc: ["'self'", 'blob:'],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
