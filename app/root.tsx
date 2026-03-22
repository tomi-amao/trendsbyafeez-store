import {useState, useEffect} from 'react';
import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  Link,
} from 'react-router';
import type {Route} from './+types/root';
import favicon from '~/assets/favicon.svg';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import tailwindCss from './styles/tailwind.css?url';
import {PageLayout} from './components/PageLayout';
import {CookieBanner} from './components/CookieBanner';

export type RootLoader = typeof loader;

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  return {
    ...deferredData,
    ...criticalData,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const env = (context as any).env as Record<string, string | undefined>;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu',
      },
    }),
  ]);

  // Fetch the typeface image for the header logo
  let typefaceUrl: string | null = null;
  try {
    const {clientId, clientSecret, storeDomain} = {
      clientId: env?.SHOPIFY_CLIENT_ID,
      clientSecret: env?.SHOPIFY_CLIENT_SECRET,
      storeDomain: env?.PUBLIC_STORE_DOMAIN,
    };
    if (clientId && clientSecret && storeDomain) {
      const token = await getAdminAccessToken(storeDomain, clientId, clientSecret);
      const files = await fetchAdminFiles(storeDomain, token, {filenamePrefix: 'TRENDSBYAFEEZ_TYPEFACE', limit: 1});
      typefaceUrl = files[0]?.image?.url ?? null;
    }
  } catch {
    // Non-critical — falls back to text logo
  }

  return {header, typefaceUrl};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={tailwindCss}></link>
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
      <CookieBanner />
    </Analytics.Provider>
  );
}

/* ─── Glyph Title — 404 scramble animation ────────────────────── */
function GlyphTitle() {
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@#!?/\\|';
  const FROM = 'I WAS NEVER HERE';
  const TO = 'PAGE NOT FOUND';
  const SPEED = 2.4;

  const [display, setDisplay] = useState(FROM);

  useEffect(() => {
    let progress = 0;
    let lastTime = 0;
    let raf: number;

    const rand = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

    function tick(now: number) {
      if (lastTime === 0) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      progress = Math.min(1, progress + dt * SPEED);
      let out = '';
      for (let i = 0; i < TO.length; i++) {
        if (TO[i] === ' ') { out += '\u2002'; continue; }
        out += progress > i / TO.length ? TO[i] : rand();
      }
      setDisplay(out);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 1000);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);

  return <>{display}</>; 
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
  }

  if (errorStatus === 404) {
    return (
      <div className="page-404">
        <span className="page-404__bg-num" aria-hidden="true">404</span>
        <p className="page-404__eyebrow">Error 404</p>
        <h1 className="page-404__title"><GlyphTitle /></h1>
        <p className="page-404__body">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Check the URL or head back to explore.
        </p>
        <nav className="page-404__actions" aria-label="Recovery navigation">
          <Link to="/" className="page-404__link">Go Home</Link>
          <Link to="/collections" className="page-404__link page-404__link--ghost">Shop All</Link>
          <Link to="/pages/gallery" className="page-404__link page-404__link--ghost">Gallery</Link>
        </nav>
      </div>
    );
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
    </div>
  );
}
