import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';

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

  return {recommendedProducts};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <HeroSection collection={data.featuredCollection} />
      <FeaturedProducts products={data.recommendedProducts} />
      <CollectionShowcase collections={data.allCollections} />
      <SplitSection />
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
        <h1 className="hero__title">{collection.title}</h1>
        <Link
          to={`/collections/${collection.handle}`}
          className="hero__cta"
          prefetch="intent"
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}

/* ─── Featured Products (deferred) ─────────────────────────────── */
function FeaturedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section className="homepage-section" aria-label="Featured Products">
      <div className="homepage-section__header">
        <h2 className="homepage-section__title">New Arrivals</h2>
        <Link to="/collections/all" className="homepage-section__link" prefetch="intent">
          View All
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="products-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="product-card product-card--skeleton">
                <div className="product-card__image" />
              </div>
            ))}
          </div>
        }
      >
        <Await resolve={products}>
          {(response) => (
            <div className="products-grid">
              {response?.products.nodes.map((product, index) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
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
  if (!collections || collections.length < 2) return null;
  // Show up to 3 collections as large editorial cards
  const showcaseCollections = collections.slice(0, 3);

  return (
    <section className="homepage-section" aria-label="Collections">
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
            <span className="collection-showcase__label">{collection.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Split Section ────────────────────────────────────────────── */
function SplitSection() {
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
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Brand Image
        </div>
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
