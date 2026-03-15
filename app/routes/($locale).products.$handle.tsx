import {redirect, useLoaderData, Await, Link} from 'react-router';
import type {Route} from './+types/products.$handle';
import {Suspense, useState, useRef, useCallback} from 'react';
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
    .query(RECOMMENDED_PRODUCTS_QUERY)
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

  const scrollToImage = useCallback((idx: number) => {
    setSelectedImageIndex(idx);
    snapRef.current?.scrollTo({left: idx * (snapRef.current.clientWidth || 0), behavior: 'smooth'});
  }, []);

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
            <div className="product-gallery__thumbs">
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
          </div>

          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            onSizeChartClick={() => setSizeChartOpen(true)}
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
                <div className="product-tabs-horizontal__panel">
                  <p>
                    Free standard shipping on all UK orders over £150. Standard delivery
                    takes 3–5 business days. Express and international shipping options
                    available at checkout.
                  </p>
                </div>
              )}
              {activeTab === 'returns' && (
                <div className="product-tabs-horizontal__panel">
                  <p>
                    We accept returns within 14 days of delivery for a full refund.
                    Items must be unworn, unwashed, and in original packaging with all
                    tags attached. All sale items are final sale.
                  </p>
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
              <h3>Size Chart</h3>
              <button
                className="size-chart-modal__close"
                onClick={() => setSizeChartOpen(false)}
                aria-label="Close size chart"
              >
                &times;
              </button>
            </div>
            <div className="size-chart-modal__body">
              <table className="size-chart-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Chest (in)</th>
                    <th>Waist (in)</th>
                    <th>Length (in)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>S</td><td>36–38</td><td>28–30</td><td>27</td></tr>
                  <tr><td>M</td><td>38–40</td><td>30–32</td><td>28</td></tr>
                  <tr><td>L</td><td>40–42</td><td>32–34</td><td>29</td></tr>
                  <tr><td>XL</td><td>42–44</td><td>34–36</td><td>30</td></tr>
                  <tr><td>XXL</td><td>44–46</td><td>36–38</td><td>31</td></tr>
                </tbody>
              </table>
              <p className="size-chart-modal__note">
                Measurements are approximate. For the best fit, we recommend measuring your body and comparing with the chart above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* You May Also Like */}
      <Suspense>
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
    encodedVariantExistence
    encodedVariantAvailability
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
