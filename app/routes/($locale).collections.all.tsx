import type {Route} from './+types/collections.all';
import {useLoaderData, useSearchParams, useNavigate, Link} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {useState, useCallback} from 'react';

export const meta: Route.MetaFunction = () => {
  return [{title: `TrendsByAfeez | All Products`}];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const url = new URL(request.url);
  const sortKey = url.searchParams.get('sort') || 'BEST_SELLING';
  const reverse = url.searchParams.get('reverse') === 'true';
  const availableOnly = url.searchParams.get('available') === 'true';
  const query = availableOnly ? 'available_for_sale:true' : undefined;

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {
        ...paginationVariables,
        sortKey: sortKey as any,
        reverse,
        query,
      },
    }),
  ]);
  return {products};
}

function loadDeferredData({context: _context}: Route.LoaderArgs) {
  return {};
}

const SORT_OPTIONS = [
  {label: 'Best Selling', value: 'BEST_SELLING', reverse: false},
  {label: 'A – Z', value: 'TITLE', reverse: false},
  {label: 'Z – A', value: 'TITLE', reverse: true},
  {label: 'Price: Low → High', value: 'PRICE', reverse: false},
  {label: 'Price: High → Low', value: 'PRICE', reverse: true},
  {label: 'Newest', value: 'CREATED_AT', reverse: true},
];

export default function AllProducts() {
  const {products} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = searchParams.get('sort') || 'BEST_SELLING';
  const currentReverse = searchParams.get('reverse') === 'true';
  const availableFilter = searchParams.get('available') === 'true';

  const handleSort = useCallback(
    (value: string, reverse: boolean) => {
      const params = new URLSearchParams(searchParams);
      params.set('sort', value);
      if (reverse) params.set('reverse', 'true');
      else params.delete('reverse');
      navigate(`?${params.toString()}`, {preventScrollReset: true});
      setSortOpen(false);
    },
    [navigate, searchParams],
  );

  const handleAvailability = useCallback(
    (available: boolean) => {
      const params = new URLSearchParams(searchParams);
      if (available) params.set('available', 'true');
      else params.delete('available');
      navigate(`?${params.toString()}`, {preventScrollReset: true});
    },
    [navigate, searchParams],
  );

  const productCount = products.nodes.length;
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort && o.reverse === currentReverse)?.label ??
    'Best Selling';

  return (
    <div className="collection">
      {/* Header */}

      {/* Controls */}
      <div className="collection-controls">
        <span className="collection-controls__count">
          {productCount} {productCount === 1 ? 'item' : 'items'}
        </span>
        <div className="collection-controls__right">
          <div className="collection-filter-group" role="group" aria-label="Filter by availability">
            <button
              className={`collection-filter-pill${!availableFilter ? ' collection-filter-pill--active' : ''}`}
              onClick={() => handleAvailability(false)}
            >
              All
            </button>
            <button
              className={`collection-filter-pill${availableFilter ? ' collection-filter-pill--active' : ''}`}
              onClick={() => handleAvailability(true)}
            >
              In Stock
            </button>
          </div>
          <div className="collection-controls__sort" style={{position: 'relative'}}>
            <button
              className="collection-controls__sort-btn"
              onClick={() => setSortOpen(!sortOpen)}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
            >
              <span className="collection-controls__sort-label">Sort:</span>
              {currentSortLabel}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{marginLeft: '5px', transition: 'transform 0.2s', transform: sortOpen ? 'rotate(180deg)' : 'none'}}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {sortOpen && (
              <ul className="collection-controls__sort-dropdown" role="listbox">
                {SORT_OPTIONS.map((opt) => {
                  const isActive = opt.value === currentSort && opt.reverse === currentReverse;
                  return (
                    <li key={opt.label} role="option" aria-selected={isActive}>
                      <button
                        onClick={() => handleSort(opt.value, opt.reverse)}
                        className={isActive ? 'is-active' : ''}
                      >
                        {isActive && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{marginRight: '6px'}}>
                            <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

      <div className="collection-products">
        <PaginatedResourceSection<CollectionItemFragment>
          connection={products}
          resourcesClassName="products-grid"
        >
          {({node: product, index}) => (
            <ProductItem
              key={product.id}
              product={product}
              loading={index < 8 ? 'eager' : undefined}
            />
          )}
        </PaginatedResourceSection>
      </div>
    </div>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment CollectionItem on Product {
    id
    handle
    title
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
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
  }
` as const;

const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $query: String
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first
      last: $last
      before: $startCursor
      after: $endCursor
      sortKey: $sortKey
      reverse: $reverse
      query: $query
    ) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
` as const;
