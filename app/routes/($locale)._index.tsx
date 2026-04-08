import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {getAdminAccessToken, fetchAdminFiles, fetchAdminHeroMedia} from '~/utils/shopify-admin.server';
import type {AdminHeroMedia} from '~/utils/shopify-admin.server';

/**
 * Hero media config — set the filename (from Shopify Files) for each
 * breakpoint, or leave as null to fall back to the collection image.
 *
 * Supports both images (.jpg, .png, .webp) and videos (.mp4, .mov).
 *
 * `position` controls the CSS object-position — i.e. which part of the
 * image/video is visible when it's cropped to fill the screen.
 * Use any valid CSS value: 'center', 'top', 'bottom', '50% 20%', etc.
 * Defaults to 'center' if omitted.
 *
 * Examples:
 *   HERO_DESKTOP: { filename: 'hero-desktop.mp4', position: 'center top' }
 *   HERO_MOBILE:  { filename: 'hero-mobile.jpg',  position: '50% 20%'    }
 *
 * Leave HERO_MOBILE as null to reuse the desktop media on all screen sizes.
 */
const HERO_DESKTOP: {filename: string; position?: string} | null = { filename: 'HOMEPAGE_LANDSCAPE' };
const HERO_MOBILE:  {filename: string; position?: string} | null = { filename: 'GDDUP' };

export const meta: Route.MetaFunction = () => {
  return [{title: 'TrendsByAfeez | Home'}];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const env = (context as any).env as Record<string, string | undefined>;

  const fetchHeroMedia = async (filename: string | null): Promise<AdminHeroMedia | null> => {
    if (!filename) return null;
    const clientId = env?.SHOPIFY_CLIENT_ID;
    const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
    const storeDomain = env?.PUBLIC_STORE_DOMAIN;
    if (!clientId || !clientSecret || !storeDomain) return null;
    try {
      const token = await getAdminAccessToken(storeDomain, clientId, clientSecret);
      return await fetchAdminHeroMedia(storeDomain, token, filename);
    } catch {
      return null;
    }
  };

  const [collectionsResult, heroDesktop, heroMobile] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      cache: context.storefront.CacheShort(),
    }),
    fetchHeroMedia(HERO_DESKTOP?.filename ?? null),
    fetchHeroMedia(HERO_MOBILE?.filename ?? null),
  ]);

  return {
    featuredCollection: collectionsResult.collections.nodes[0],
    allCollections: collectionsResult.collections.nodes,
    heroDesktop,
    // If no mobile-specific file was configured, fall back to desktop
    heroMobile: heroMobile ?? heroDesktop,
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY, {
      cache: context.storefront.CacheShort(),
    })
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

/* ─── Glyph Scramble CTA ───────────────────────────────────────── */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@#!?/\\|';

function ScrambleCta({
  from,
  to,
  speed = 2.4,
  delay = 1400,
}: {
  from: string;
  to: string;
  speed?: number;
  delay?: number;
}) {
  const [display, setDisplay] = useState(from);
  useEffect(() => {
    let progress = 0;
    let lastTime = 0;
    let raf: number;
    const rand = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    function tick(now: number) {
      if (lastTime === 0) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      progress = Math.min(1, progress + dt * speed);
      let out = '';
      for (let i = 0; i < to.length; i++) {
        if (to[i] === ' ') { out += '\u2002'; continue; }
        out += progress > i / to.length ? to[i] : rand();
      }
      setDisplay(out);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span className="hero__cta-text">{display}</span>;
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
      <HeroSection
        collection={data.featuredCollection}
        heroDesktop={data.heroDesktop ?? null}
        heroMobile={data.heroMobile ?? null}
        desktopPosition={HERO_DESKTOP?.position}
        mobilePosition={HERO_MOBILE?.position}
      />
      {/* <FeaturedProducts products={data.recommendedProducts} /> */}
      {/* <CollectionShowcase collections={data.allCollections} /> */}
      {/* <BrandValues /> */}
      {/* <SplitSection brandImage={data.brandImage} /> */}
    </div>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────── */
function HeroMedia({
  media,
  className,
  position,
}: {
  media: AdminHeroMedia;
  className?: string;
  position?: string;
}) {
  const style = position ? {objectPosition: position} : undefined;
  if (media.type === 'video') {
    return (
      <video
        className={className}
        style={style}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      >
        {media.sources.map((s) => (
          <source key={s.url} src={s.url} type={s.mimeType ?? undefined} />
        ))}
      </video>
    );
  }
  return (
    <img
      src={media.url}
      className={className}
      style={style}
      alt={media.altText ?? ''}
      loading="eager"
      decoding="async"
    />
  );
}

function HeroSection({
  collection,
  heroDesktop,
  heroMobile,
  desktopPosition,
  mobilePosition,
}: {
  collection: FeaturedCollectionFragment;
  heroDesktop: AdminHeroMedia | null;
  heroMobile: AdminHeroMedia | null;
  desktopPosition?: string;
  mobilePosition?: string;
}) {
  if (!collection) return null;
  const fallbackImage = collection.image;

  const desktop = heroDesktop;
  const mobile = heroMobile;
  const hasSeparateMobile = !!HERO_MOBILE;

  const bothImages =
    desktop?.type === 'image' && mobile?.type === 'image';

  return (
    <section className="hero">
      {/* ── Configured media ───────────────────────── */}
      {desktop && bothImages && hasSeparateMobile && mobile ? (
        // Two images → native <picture> responsive loading
        <picture className="hero__picture">
          <source
            media="(min-width: 768px)"
            srcSet={(desktop as Extract<AdminHeroMedia, {type: 'image'}>).url}
          />
          <img
            src={(mobile as Extract<AdminHeroMedia, {type: 'image'}>).url}
            className="hero__image"
            style={{objectPosition: desktopPosition ?? mobilePosition ?? 'center'}}
            alt={desktop.altText ?? fallbackImage?.altText ?? collection.title}
            loading="eager"
            decoding="async"
          />
        </picture>
      ) : desktop ? (
        // Single source (or one is a video) — render both with CSS show/hide
        <>
          <HeroMedia
            media={desktop}
            className={`hero__image hero__image--desktop`}
            position={desktopPosition}
          />
          {hasSeparateMobile && mobile && (
            <HeroMedia
              media={mobile}
              className="hero__image hero__image--mobile"
              position={mobilePosition}
            />
          )}
        </>
      ) : fallbackImage ? (
        // Fallback to Shopify collection image
        <img
          src={fallbackImage.url}
          className="hero__image"
          alt={fallbackImage.altText ?? collection.title}
          loading="eager"
          decoding="async"
        />
      ) : null}

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
            <ScrambleCta from="IF YOU SAW ME" to="SHOP NOW" delay={1400} />
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
    tags
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
