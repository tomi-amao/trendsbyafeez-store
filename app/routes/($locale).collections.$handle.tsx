import {redirect, useLoaderData, useSearchParams, useNavigate, Link} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics, Image} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useState, useCallback} from 'react';

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

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        sortKey: sortKey as any,
        reverse,
        ...paginationVariables,
      },
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {collection};
}

function loadDeferredData({context}: Route.LoaderArgs) {
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
  const {collection} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = searchParams.get('sort') || 'COLLECTION_DEFAULT';
  const currentReverse = searchParams.get('reverse') === 'true';

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

  const productCount = collection.products.nodes.length;

  return (
    <div className="collection">
      {/* Collection Header */}
      <div className="collection-header">
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
        <div className="collection-header__content">
          <h1 className="collection-header__title">{collection.title}</h1>
          {collection.description && (
            <p className="collection-header__desc">{collection.description}</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="collection-toolbar">
        <span className="collection-toolbar__count">
          {productCount} {productCount === 1 ? 'Product' : 'Products'}
        </span>
        <div className="collection-toolbar__actions">
          <div style={{position: 'relative'}}>
            <button
              className="collection-toolbar__sort-btn"
              onClick={() => setSortOpen(!sortOpen)}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
            >
              Sort
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{marginLeft: '6px'}}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {sortOpen && (
              <ul className="collection-toolbar__sort-dropdown" role="listbox">
                {SORT_OPTIONS.map((opt) => {
                  const isActive = opt.value === currentSort && opt.reverse === currentReverse;
                  return (
                    <li key={opt.label} role="option" aria-selected={isActive}>
                      <button
                        onClick={() => handleSort(opt.value, opt.reverse)}
                        style={{
                          fontWeight: isActive ? 700 : 400,
                          opacity: isActive ? 1 : 0.7,
                        }}
                      >
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

      {/* Product Grid */}
      <PaginatedResourceSection<ProductItemFragment>
        connection={collection.products}
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
    featuredImage {
      id
      altText
      url
      width
      height
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
        reverse: $reverse
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
