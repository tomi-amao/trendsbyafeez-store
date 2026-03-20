import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';

export const meta: Route.MetaFunction = () => {
  return [{title: 'TrendsByAfeez | Home'}];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
  ]);

  return {
    featuredCollection: collections.nodes[0],
    allCollections: collections.nodes,
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  const env = (context as any).env as Record<string, string | undefined>;
  const brandImage = (async () => {
    const clientId = env?.SHOPIFY_CLIENT_ID;
    const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
    const storeDomain = env?.PUBLIC_STORE_DOMAIN;
    if (!clientId || !clientSecret || !storeDomain) return null;
    try {
      const token = await getAdminAccessToken(storeDomain, clientId, clientSecret);
      const files = await fetchAdminFiles(storeDomain, token, {
        filenamePrefix: 'CROWN_COLLECTION_2',
        limit: 1,
      });
      const img = files[0]?.image;
      if (!img) return null;
      return {url: img.url, width: img.width, height: img.height, altText: files[0].alt};
    } catch {
      return null;
    }
  })();

  return {recommendedProducts, brandImage};
}

/* ─── Scroll Reveal Hook ───────────────────────────────────────── */
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal--visible');
          observer.disconnect();
        }
      },
      {threshold: 0.1, rootMargin: '0px 0px -40px 0px'},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <HeroSection collection={data.featuredCollection} />
      {/* <FeaturedProducts products={data.recommendedProducts} /> */}
      {/* <CollectionShowcase collections={data.allCollections} /> */}
      {/* <BrandValues /> */}
      {/* <SplitSection brandImage={data.brandImage} /> */}
    </div>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────── */
function HeroSection({collection}: {collection: FeaturedCollectionFragment}) {
  if (!collection) return null;
  const image = collection.image;

  return (
    <section className="hero">
      {image && (
        <Image
          data={image}
          sizes="100vw"
          className="hero__image"
          alt={image.altText || collection.title}
          loading="eager"
        />
      )}
      <div className="hero__overlay" />
      <div className="hero__content">
        {/* <span className="hero__tag">Now Available</span> */}
        {/* <h1 className="hero__title">
          <span className="hero__title-line">{collection.title}</span>
        </h1> */}
        {collection.description && (
          <p className="hero__description">{collection.description}</p>
        )}
        <div className="hero__actions">
          <Link
            to={`/collections/${collection.handle}`}
            className="hero__cta"
            prefetch="intent"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Featured Products (carousel) ─────────────────────────────── */
function FeaturedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  const sectionRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className="homepage-section reveal" aria-label="Featured Products">
      <div className="homepage-section__header">
        <h2 className="homepage-section__title">New Arrivals</h2>
        <Link to="/collections/all" className="homepage-section__link" prefetch="intent">
          View All
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="products-carousel">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="products-carousel__item">
                <div className="product-card product-card--skeleton">
                  <div className="product-card__image" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <Await resolve={products}>
          {(response) => (
            <div className="products-carousel">
              {response?.products.nodes.map((product, index) => (
                <div key={product.id} className="products-carousel__item">
                  <ProductItem
                    product={product}
                    loading={index < 4 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}
            </div>
          )}
        </Await>
      </Suspense>
    </section>
  );
}

/* ─── Collection Showcase ──────────────────────────────────────── */
function CollectionShowcase({
  collections,
}: {
  collections: FeaturedCollectionFragment[];
}) {
  const sectionRef = useScrollReveal<HTMLElement>();

  if (!collections || collections.length < 2) return null;
  const showcaseCollections = collections.slice(0, 3);

  return (
    <section ref={sectionRef} className="homepage-section reveal" aria-label="Collections">
      <div className="homepage-section__header">
        <h2 className="homepage-section__title">Collections</h2>
        <Link to="/collections" className="homepage-section__link" prefetch="intent">
          All Collections
        </Link>
      </div>
      <div className="collection-showcase">
        {showcaseCollections.map((collection) => (
          <Link
            key={collection.id}
            to={`/collections/${collection.handle}`}
            className="collection-showcase__card"
            prefetch="intent"
          >
            {collection.image && (
              <Image
                data={collection.image}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="collection-showcase__image"
                alt={collection.image.altText || collection.title}
              />
            )}
            <div className="collection-showcase__overlay" />
            <div className="collection-showcase__content">
              <span className="collection-showcase__label">{collection.title}</span>
              {collection.description && (
                <p className="collection-showcase__desc">
                  {collection.description.length > 75
                    ? collection.description.slice(0, 75) + '\u2026'
                    : collection.description}
                </p>
              )}
              <span className="collection-showcase__cta">Shop Now</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Marquee Divider ─────────────────────────────────────────── */
function MarqueeDivider() {
  const text = 'IF YOU SAW ME \u00B7 I WAS NEVER THERE \u00B7 ';
  return (
    <div className="marquee-divider" aria-hidden="true">
      <div className="marquee-divider__track">
        <span className="marquee-divider__text">{text}{text}{text}{text}</span>
      </div>
    </div>
  );
}

// /* ─── Brand Values ─────────────────────────────────────────────── */
// function BrandValues() {
//   const ref = useScrollReveal<HTMLElement>();
//   const values = [
//     {icon: '\u2726', title: 'Curated Selection', desc: 'Every piece handpicked for quality and style.'},
//     {icon: '\u2606', title: 'Modern Design', desc: 'Contemporary silhouettes that stand the test of time.'},
//     {icon: '\u25CB', title: 'Quality First', desc: 'Premium materials crafted to last.'},
//   ];

//   return (
//     <section ref={ref} className="brand-values reveal">
//       <div className="brand-values__grid">
//         {values.map((v) => (
//           <div key={v.title} className="brand-values__item">
//             <span className="brand-values__icon">{v.icon}</span>
//             <h3 className="brand-values__title">{v.title}</h3>
//             <p className="brand-values__desc">{v.desc}</p>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }

/* ─── Split Section ────────────────────────────────────────────── */
function SplitSection({
  brandImage,
}: {
  brandImage: Promise<{url: string; width: number | null; height: number | null; altText: string | null} | null>;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('scroll-reveal--visible');
          observer.disconnect();
        }
      },
      {threshold: 0.15},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="split-section scroll-reveal">
      <div className="split-section__media">
        <Suspense
          fallback={
            <div className="split-section__placeholder" />
          }
        >
          <Await resolve={brandImage}>
            {(img) =>
              img ? (
                <img
                  src={img.url}
                  alt={img.altText || 'TrendsByAfeez'}
                  width={img.width ?? undefined}
                  height={img.height ?? undefined}
                  loading="lazy"
                  className="split-section__image"
                />
              ) : (
                <div className="split-section__placeholder" />
              )
            }
          </Await>
        </Suspense>
      </div>
      <div className="split-section__content">
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 300,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          Crafted with Purpose
        </h2>
        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.8,
            opacity: 0.7,
            marginBottom: '2rem',
            maxWidth: '420px',
          }}
        >
          Every piece in our collection is designed to stand the test of time — balancing modern
          silhouettes with enduring quality.
        </p>
        <Link
          to="/collections/all"
          className="hero__cta"
          style={{alignSelf: 'flex-start'}}
          prefetch="intent"
        >
          Explore
        </Link>
      </div>
    </section>
  );
}

/* ─── GraphQL ──────────────────────────────────────────────────── */
const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    description
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    availableForSale
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
