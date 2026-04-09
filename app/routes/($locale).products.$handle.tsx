import {redirect, useLoaderData, Await, Link} from 'react-router';
import type {Route} from './+types/products.$handle';
import {Suspense, useState, useRef, useCallback, useEffect} from 'react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  Image,
  Money,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductForm} from '~/components/ProductForm';
import {ProductItem} from '~/components/ProductItem';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: `TrendsByAfeez | ${data?.product.title ?? ''}`},
    {rel: 'canonical', href: `/products/${data?.product.handle}`},
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
      cache: storefront.CacheShort(),
    }),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {product};
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

  return {recommendedProducts};
}

export default function Product() {
  const {product, recommendedProducts} = useLoaderData<typeof loader>();

  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml, vendor} = product;

  // Collect all images for gallery
  const images = product.images?.nodes || [];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const snapRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const scrollToImage = useCallback((idx: number) => {
    setSelectedImageIndex(idx);
    snapRef.current?.scrollTo({left: idx * (snapRef.current.clientWidth || 0), behavior: 'smooth'});
  }, []);

  // Keep active thumb scrolled into view
  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const activeThumb = container.children[selectedImageIndex] as HTMLElement | undefined;
    activeThumb?.scrollIntoView({inline: 'nearest', block: 'nearest', behavior: 'smooth'});
  }, [selectedImageIndex]);

  const handleSnapScroll = useCallback(() => {
    const el = snapRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setSelectedImageIndex(idx);
  }, []);

  // Horizontal tabs state (denimtears style)
  const [activeTab, setActiveTab] = useState<'details' | 'shipping' | 'returns'>('details');

  // Size chart modal state
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  return (
    <>
      <div className="product">
        {/* Image Gallery - vertical scroll on desktop, swipe snap on mobile */}
        <div className="product-gallery">
          {/* Mobile: horizontal swipe/scroll-snap gallery */}
          <div
            className="product-gallery__mobile-snap"
            ref={snapRef}
            onScroll={handleSnapScroll}
          >
            {(images.length > 0 ? images : selectedVariant?.image ? [selectedVariant.image] : []).map((img, idx) => (
              <div key={img.id || idx} className="product-gallery__mobile-snap-item">
                <Image
                  alt={img.altText || `${title} ${idx + 1}`}
                  data={img}
                  sizes="100vw"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>

          {/* Mobile: thumbnail strip — synced with snap gallery */}
          {images.length > 1 && (
            <div className="product-gallery__thumbs" ref={thumbsRef}>
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => scrollToImage(idx)}
                  className={`product-gallery__thumb${
                    idx === selectedImageIndex ? ' product-gallery__thumb--active' : ''
                  }`}
                  aria-label={`View image ${idx + 1}`}
                >
                  <Image
                    alt={img.altText || `${title} ${idx + 1}`}
                    data={img}
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Desktop: scrollable image column — always rendered, falls back to variant image */}
          <div className="product-gallery__scroll">
            {(images.length > 0 ? images : selectedVariant?.image ? [selectedVariant.image] : []).map((img, idx) => (
              <div
                key={img.id}
                className="product-gallery__scroll-item"
                onClick={() => setSelectedImageIndex(idx)}
              >
                <Image
                  alt={img.altText || `${title} ${idx + 1}`}
                  data={img}
                  sizes="(min-width: 768px) 55vw, 100vw"
                  loading={idx < 2 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product Info Sidebar */}
        <div className="product-info">
          {vendor && <p className="product-info__vendor">{vendor}</p>}
          <h1 className="product-info__title">{title}</h1>
          <div className="product-info__price">
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
            {/* {(() => {
              const inv = (product as any).totalInventory;
              return typeof inv === 'number' && inv > 0 && inv <= 5 ? (
                <p className="product-info__low-stock" aria-live="polite">
                  Only {inv} left
                </p>
              ) : null;
            })()} */}
          </div>

          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            onSizeChartClick={() => setSizeChartOpen(true)}
            comingSoon={product.tags?.some((t: string) => t.toUpperCase() === 'COMING_SOON') ?? false}
          />

          {/* Horizontal Tabs (denimtears style) */}
          <div className="product-tabs-horizontal">
            <div className="product-tabs-horizontal__nav">
              <button
                className={`product-tabs-horizontal__tab ${activeTab === 'details' ? 'product-tabs-horizontal__tab--active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`product-tabs-horizontal__tab ${activeTab === 'shipping' ? 'product-tabs-horizontal__tab--active' : ''}`}
                onClick={() => setActiveTab('shipping')}
              >
                Shipping
              </button>
              <button
                className={`product-tabs-horizontal__tab ${activeTab === 'returns' ? 'product-tabs-horizontal__tab--active' : ''}`}
                onClick={() => setActiveTab('returns')}
              >
                Returns & Exchanges
              </button>
            </div>
            <div className="product-tabs-horizontal__content">
              {activeTab === 'details' && (
                <div
                  className="product-tabs-horizontal__panel"
                  dangerouslySetInnerHTML={{__html: descriptionHtml}}
                />
              )}
              {activeTab === 'shipping' && (
                <div className="product-tabs-horizontal__panel product-tabs-horizontal__panel--policy">
                  <p>TRENDSBYAFEEZ ships worldwide.</p>
                  <p>Orders are processed and dispatched within 1–2 business days. During promotional periods or seasonal releases, processing may take up to 3–7 business days.</p>
                  <p>Once your order has been shipped, you will receive a confirmation email with tracking details.</p>
                  <h4>International Shipping</h4>
                  <p>All international orders are shipped on a DAP (Delivered At Place) basis.</p>
                  <p>Duties and taxes are not included at checkout and are the responsibility of the customer upon arrival in the destination country. These charges are set by local customs authorities and are outside of our control.</p>
                  <p>Please note, shipments to the United States may be subject to additional tariffs on selected items.</p>
                  <h4>Delivery</h4>
                  <p>Shipping costs and estimated delivery times are calculated at checkout.</p>
                </div>
              )}
              {activeTab === 'returns' && (
                <div className="product-tabs-horizontal__panel product-tabs-horizontal__panel--policy">
                  <p>We operate a strict no returns, no refunds policy. All sales are final.</p>
                  <p>We do not accept returns or offer refunds for: change of mind, incorrect size selection, or preference/dissatisfaction after purchase.</p>
                  <p>We strongly recommend reviewing all product details, sizing information, and imagery before placing an order.</p>
                  <h4>Damaged or Faulty Items</h4>
                  <p>We will only offer a replacement or refund if an item arrives damaged or faulty. To be eligible:</p>
                  <ul>
                    <li>You must contact us within 48 hours of delivery</li>
                    <li>Provide clear photo/video evidence of the issue</li>
                    <li>Item(s) must be unused and in original condition</li>
                  </ul>
                  <p>If approved, we will offer a replacement (if available) or issue a refund.</p>
                  <h4>Non-Eligible Claims</h4>
                  <p>We do not accept claims for minor colour variations due to lighting or screen display, normal wear and tear, or incorrect sizing choices.</p>
                  <h4>Contact</h4>
                  <p>For all enquiries contact <a href="mailto:info@trendsbyafeez.com">info@trendsbyafeez.com</a> with your order number, description of issue, and supporting images.</p>
                  <p>By completing your purchase, you agree to this policy.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Analytics.ProductView
          data={{
            products: [
              {
                id: product.id,
                title: product.title,
                price: selectedVariant?.price.amount || '0',
                vendor: product.vendor,
                variantId: selectedVariant?.id || '',
                variantTitle: selectedVariant?.title || '',
                quantity: 1,
              },
            ],
          }}
        />
      </div>

      {/* Size Chart Modal */}
      {sizeChartOpen && (
        <div className="size-chart-overlay" onClick={() => setSizeChartOpen(false)}>
          <div className="size-chart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="size-chart-modal__header">
              <h3>Size Chart (CM)</h3>
              <button
                className="size-chart-modal__close"
                onClick={() => setSizeChartOpen(false)}
                aria-label="Close size chart"
              >
                &times;
              </button>
            </div>
            <div className="size-chart-modal__body">
              <SizeChart handle={product.handle} />
            </div>
          </div>
        </div>
      )}

      {/* You May Also Like */}
      <Suspense fallback={<div className="homepage-section" style={{minHeight: '320px'}} />}>
        <Await resolve={recommendedProducts}>
          {(response) =>
            response?.products.nodes.length ? (
              <section className="homepage-section" style={{marginTop: 0}}>
                <div className="homepage-section__header">
                  <h2 className="homepage-section__title">You May Also Like</h2>
                </div>
                <div className="products-carousel">
                  {response.products.nodes
                    .filter((p) => p.id !== product.id)
                    .slice(0, 4)
                    .map((p) => (
                      <div key={p.id} className="products-carousel__item">
                        <ProductItem product={p} />
                      </div>
                    ))}
                </div>
              </section>
            ) : null
          }
        </Await>
      </Suspense>
    </>
  );
}

/* ─── Size Charts ──────────────────────────────────────────────── */
type SizeChartData = {
  sizes: string[];
  rows: { label: string; values: (string | number)[] }[];
  unit: string;
};

const SIZE_CHARTS: Record<string, SizeChartData> = {
  'transit-cargo-pant-v2': {
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    unit: 'cm',
    rows: [
      {label: 'Total Length',             values: [107, 109.5, 112, 114.5, 117]},
      {label: 'Inseam Length',            values: [79,  80.5,  82,  83.5,  85]},
      {label: 'Half Waist',               values: [41,  43.5,  46,  48.5,  51]},
      {label: 'Half Hip',                 values: [52.5, 55,   57.5, 60,   62.5]},
      {label: 'Half Thigh',               values: [35,  36.25, 37.5, 38.75, 40]},
      {label: 'Half Bottom',              values: [21.5, 22.5,  23.5, 24.5, 25.5]},
      {label: 'Front Rise with Waistband',values: [29.5, 30.5,  31.5, 32.5, 33.5]},
      {label: 'Back Rise with Waistband', values: [42.5, 43.5,  44.5, 45.5, 46.5]},
    ],
  },
};

const DEFAULT_SIZE_CHART: SizeChartData = {
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  unit: 'in',
  rows: [
    {label: 'Chest',  values: ['36–38', '38–40', '40–42', '42–44', '44–46']},
    {label: 'Waist',  values: ['28–30', '30–32', '32–34', '34–36', '36–38']},
    {label: 'Length', values: [27, 28, 29, 30, 31]},
  ],
};

function SizeChart({handle}: {handle: string}) {
  const chart = SIZE_CHARTS[handle] ?? DEFAULT_SIZE_CHART;
  return (
    <>
      <table className="size-chart-table">
        <thead>
          <tr>
            <th></th>
            {chart.sizes.map((s) => <th key={s}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {row.values.map((v, i) => <td key={i}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="size-chart-modal__note">
        All measurements in {chart.unit}. Measurements are approximate — we recommend measuring your body and comparing with the chart above.
      </p>
    </>
  );
}

/* ─── GraphQL ──────────────────────────────────────────────────── */
const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    tags
    encodedVariantExistence
    encodedVariantAvailability
    totalInventory
    images(first: 20) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
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
  query RecommendedProducts($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
