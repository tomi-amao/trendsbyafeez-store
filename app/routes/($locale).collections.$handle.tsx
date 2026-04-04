import {redirect, useLoaderData, useSearchParams, useNavigate, Link} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics, Image, Pagination} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useState, useCallback} from 'react';
import React from 'react';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';

/* ─── Editorial Tile ─────────────────────────────────────────────── */
interface EditorialImage {
  id: string;
  url: string;
  alt: string | null;
}

interface EditorialConfig {
  filenamePrefix: string;
  link: string;
  interval: number;
}

const EDITORIAL_COLLECTIONS: Record<string, EditorialConfig> = {
  crowns: {
    filenamePrefix: 'EDITORIAL_CROWN_',
    link: '/collections/crowns',
    interval: 4,
  },
  ss26: {
    filenamePrefix: 'EDITORIAL_SS26_',
    link: '/collections/og-ss26',
    interval: 2,
  },
};

function EditorialTile({image, editorialIndex, link}: {image: EditorialImage; editorialIndex: number; link: string}) {
  const side = editorialIndex % 2 === 0 ? 'left' : 'right';
  return (
    <Link to={link} className={`editorial-tile editorial-tile--${side}`} prefetch="none">
      <img
        src={image.url}
        alt={image.alt || 'Editorial'}
        className="editorial-tile__img"
        loading="lazy"
      />
    </Link>
  );
}

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `TrendsByAfeez | ${data?.collection.title ?? ''} Collection`}];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});

  if (!handle) {
    throw redirect('/collections');
  }

  const url = new URL(request.url);
  const sortKey = url.searchParams.get('sort') || 'COLLECTION_DEFAULT';
  const reverse = url.searchParams.get('reverse') === 'true';
  const availableOnly = url.searchParams.get('available') === 'true';

  const filters: {available?: boolean}[] = availableOnly ? [{available: true}] : [];

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        sortKey: sortKey as any,
        reverse,
        filters,
        ...paginationVariables,
      },
      cache: storefront.CacheShort(),
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle, data: collection});

  // Fetch editorial images for configured collections
  let editorialImages: EditorialImage[] = [];
  const editorialConfig = handle
    ? Object.entries(EDITORIAL_COLLECTIONS).find(([key]) => handle.includes(key))?.[1]
    : undefined;
  if (editorialConfig) {
    try {
      const env = (context as any).env as Record<string, string | undefined>;
      const clientId = env?.SHOPIFY_CLIENT_ID;
      const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
      const storeDomain = env?.PUBLIC_STORE_DOMAIN;
      if (clientId && clientSecret && storeDomain) {
        const adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret);
        const files = await fetchAdminFiles(storeDomain, adminToken, {
          filenamePrefix: editorialConfig.filenamePrefix,
          limit: 20,
        });
        editorialImages = files
          .filter((f) => f.image !== null)
          .map((f) => ({id: f.id, url: f.image!.url, alt: f.alt}));
      }
    } catch {
      // Editorial images are optional — fail gracefully
    }
  }

  return {collection, editorialImages};
}

function loadDeferredData(_args: Route.LoaderArgs) {
  return {};
}

const SORT_OPTIONS = [
  {label: 'Featured', value: 'COLLECTION_DEFAULT', reverse: false},
  {label: 'Best Selling', value: 'BEST_SELLING', reverse: false},
  {label: 'A – Z', value: 'TITLE', reverse: false},
  {label: 'Z – A', value: 'TITLE', reverse: true},
  {label: 'Price: Low → High', value: 'PRICE', reverse: false},
  {label: 'Price: High → Low', value: 'PRICE', reverse: true},
  {label: 'Newest', value: 'CREATED', reverse: true},
];

export default function Collection() {
  const {collection, editorialImages} = useLoaderData<typeof loader>();
  const editorialConfig = Object.entries(EDITORIAL_COLLECTIONS).find(([key]) => collection.handle.includes(key))?.[1];
  const hasEditorial = !!editorialConfig && editorialImages.length > 0;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = searchParams.get('sort') || 'COLLECTION_DEFAULT';
  const currentReverse = searchParams.get('reverse') === 'true';
  const availableFilter = searchParams.get('available') === 'true';

  const handleSort = useCallback(
    (value: string, reverse: boolean) => {
      const params = new URLSearchParams(searchParams);
      params.set('sort', value);
      if (reverse) {
        params.set('reverse', 'true');
      } else {
        params.delete('reverse');
      }
      navigate(`?${params.toString()}`, {preventScrollReset: true});
      setSortOpen(false);
    },
    [navigate, searchParams],
  );

  const handleAvailability = useCallback(
    (available: boolean) => {
      const params = new URLSearchParams(searchParams);
      if (available) {
        params.set('available', 'true');
      } else {
        params.delete('available');
      }
      navigate(`?${params.toString()}`, {preventScrollReset: true});
    },
    [navigate, searchParams],
  );

  const productCount = collection.products.nodes.length;
  const currentSortLabel =
    SORT_OPTIONS.find(
      (o) => o.value === currentSort && o.reverse === currentReverse,
    )?.label ?? 'Featured';

  return (
    <div className="">
      {/* Collection Header */}
      {/* <div className="collection-header">
        {collection.image && (
          <>
            <Image
              data={collection.image}
              sizes="100vw"
              className="collection-header__image"
              alt={collection.image.altText || collection.title}
              loading="eager"
            />
            <div className="collection-header__overlay" />
          </>
        )}
        <div className="collection-header__content collection-header__content--bottom-left">
          <h1 className="collection-header__title collection-header__title--sm">{collection.title}</h1>
        </div>
      </div> */}

      {/* ── Sticky Controls Bar ── */}
      <div className="collection-controls">
        <span className="collection-controls__count">
          {productCount} {productCount === 1 ? 'item' : 'items'}
        </span>

        <div className="collection-controls__right">
          {/* Availability filter pills */}
          <div className="collection-filter-group" role="group" aria-label="Filter by availability">
            <button
              className={`collection-filter-pill${
                !availableFilter ? ' collection-filter-pill--active' : ''
              }`}
              onClick={() => handleAvailability(false)}
            >
              All
            </button>
            <button
              className={`collection-filter-pill${
                availableFilter ? ' collection-filter-pill--active' : ''
              }`}
              onClick={() => handleAvailability(true)}
            >
              In Stock
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="collection-controls__sort" style={{position: 'relative'}}>
            <button
              className="collection-controls__sort-btn"
              onClick={() => setSortOpen(!sortOpen)}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
            >
              <span className="collection-controls__sort-label">Sort:</span>
              {currentSortLabel}
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                style={{marginLeft: '5px', transition: 'transform 0.2s', transform: sortOpen ? 'rotate(180deg)' : 'none'}}
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {sortOpen && (
              <ul className="collection-controls__sort-dropdown" role="listbox">
                {SORT_OPTIONS.map((opt) => {
                  const isActive =
                    opt.value === currentSort &&
                    opt.reverse === currentReverse;
                  return (
                    <li key={opt.label} role="option" aria-selected={isActive}>
                      <button
                        onClick={() => handleSort(opt.value, opt.reverse)}
                        className={isActive ? 'is-active' : ''}
                      >
                        {isActive && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{marginRight: '6px'}}>
                            <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="collection-products">
        <Pagination connection={collection.products}>
          {({nodes: rawNodes, isLoading, PreviousLink, NextLink}) => {
            const nodes = rawNodes as ProductItemFragment[];
            // Build a mixed grid of product cards + editorial tiles.
            // We compute editorial placements up-front with full awareness of
            // how many products remain after each insertion point, so we never
            // leave phantom empty rows.
            type GridItem =
              | {type: 'product'; product: ProductItemFragment; index: number}
              | {type: 'editorial'; editorialIndex: number};

            const items: GridItem[] = [];

            if (hasEditorial && editorialConfig) {
              const interval = editorialConfig.interval;
              let editorialCount = 0;

              nodes.forEach((product, index) => {
                // Insert editorial before this product if it's at an even interval
                // AND at least 1 product remains after this point so the
                // tile appears "between" real content rather than at the very end.
                if (index > 0 && index % interval === 0) {
                  const productsRemaining = nodes.length - index;
                  if (productsRemaining >= 1) {
                    items.push({type: 'editorial', editorialIndex: editorialCount});
                    editorialCount++;
                  }
                }
                items.push({type: 'product', product, index});
              });
            } else {
              nodes.forEach((product, index) => {
                items.push({type: 'product', product, index});
              });
            }

            return (
              <div>
                <div className="pagination-link">
                  <PreviousLink>
                    {isLoading ? 'Loading...' : <span className="pagination-btn">Load Previous</span>}
                  </PreviousLink>
                </div>
                <div className={`products-grid${hasEditorial ? ' products-grid--editorial' : ''}`}>
                  {items.map((item) => {
                    if (item.type === 'editorial') {
                      return (
                        <EditorialTile
                          key={`editorial-${item.editorialIndex}`}
                          image={editorialImages[item.editorialIndex % editorialImages.length]}
                          editorialIndex={item.editorialIndex}
                          link={editorialConfig?.link ?? '#'}
                        />
                      );
                    }
                    return (
                      <ProductItem
                        key={item.product.id}
                        product={item.product}
                        loading={item.index < 8 ? 'eager' : undefined}
                      />
                    );
                  })}
                </div>
                <div className="pagination-link">
                  <NextLink>
                    {isLoading ? 'Loading...' : <span className="pagination-btn">Load More</span>}
                  </NextLink>
                </div>
              </div>
            );
          }}
        </Pagination>
      </div>

      {/* Sparse collection prompt */}
      {productCount <= 2 && (
        <div className="collection-sparse">
          <p className="collection-sparse__text">More styles coming soon.</p>
          <Link to="/collections" className="collection-sparse__link">
            Explore All Collections
          </Link>
        </div>
      )}

      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    tags
    availableForSale
    totalInventory
    featuredImage {
      id
      altText
      url
      width
      height
    }
    images(first: 2) {
      nodes {
        id
        altText
        url
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $filters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image {
        id
        url
        altText
        width
        height
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        sortKey: $sortKey,
        reverse: $reverse,
        filters: $filters
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
