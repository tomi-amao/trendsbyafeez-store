import {redirect, useLoaderData, Await, Link} from 'react-router';
import type {Route} from './+types/products.$handle';
import {Suspense, useState, useCallback} from 'react';
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

  // Collect all variant images for the gallery
  const images = product.images?.nodes || [];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const selectedImage = images[selectedImageIndex] || selectedVariant?.image;

  return (
    <>
      <div className="product">
        {/* Image Gallery */}
        <div className="product-gallery">
          <div className="product-gallery__main">
            {selectedImage && (
              <Image
                alt={selectedImage.altText || title}
                data={selectedImage}
                key={selectedImage.id}
                sizes="(min-width: 768px) 55vw, 100vw"
                className="product-gallery__image"
                loading="eager"
              />
            )}
          </div>
          {images.length > 1 && (
            <div className="product-gallery__thumbs">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`product-gallery__thumb ${
                    idx === selectedImageIndex ? 'product-gallery__thumb--active' : ''
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
        </div>

        {/* Product Info (Sticky Sidebar) */}
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
          />

          {/* Accordion Tabs */}
          <div className="product-tabs">
            <AccordionTab title="Details" defaultOpen>
              <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
            </AccordionTab>
            <AccordionTab title="Shipping">
              <p>
                Free standard shipping on orders over $300. Standard delivery takes
                5–7 business days. Express options available at checkout.
              </p>
            </AccordionTab>
            <AccordionTab title="Returns & Exchanges">
              <p>
                We accept returns within 14 days of delivery for a full refund.
                Items must be unworn, unwashed, and in their original packaging
                with tags attached.
              </p>
            </AccordionTab>
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

      {/* You May Also Like */}
      <Suspense>
        <Await resolve={recommendedProducts}>
          {(response) =>
            response?.products.nodes.length ? (
              <section className="homepage-section" style={{marginTop: 0}}>
                <div className="homepage-section__header">
                  <h2 className="homepage-section__title">You May Also Like</h2>
                </div>
                <div className="products-grid">
                  {response.products.nodes
                    .filter((p) => p.id !== product.id)
                    .slice(0, 4)
                    .map((p) => (
                      <ProductItem key={p.id} product={p} />
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

/* ─── Accordion Tab ────────────────────────────────────────────── */
function AccordionTab({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`product-tab ${open ? 'product-tab--open' : ''}`}>
      <button
        className="product-tab__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="product-tab__content"
        style={{
          maxHeight: open ? '500px' : '0',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s ease, opacity 0.3s ease',
        }}
      >
        <div style={{paddingBottom: '1rem'}}>{children}</div>
      </div>
    </div>
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
