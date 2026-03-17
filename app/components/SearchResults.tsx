import {Link} from 'react-router';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';

type SearchItems = RegularSearchReturn['result']['items'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section className="search-results-section">
      <h2 className="search-results-section__title">Articles</h2>
      <ul className="search-results-list">
        {articles?.nodes?.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <li className="search-results-list__item" key={article.id}>
              <Link prefetch="intent" to={articleUrl} className="search-results-list__link">
                <span className="search-results-list__name">{article.title}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <section className="search-results-section">
      <h2 className="search-results-section__title">Pages</h2>
      <ul className="search-results-list">
        {pages?.nodes?.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <li className="search-results-list__item" key={page.id}>
              <Link prefetch="intent" to={pageUrl} className="search-results-list__link">
                <span className="search-results-list__name">{page.title}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <section className="search-results-section search-results-section--products">
      <h2 className="search-results-section__title">
        Products <span className="search-results-section__count">({products.nodes.length})</span>
      </h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => (
          <div>
            <div className="search-pagination-link">
              <PreviousLink>
                {isLoading ? 'Loading…' : <span className="search-pagination-btn">↑ Load previous</span>}
              </PreviousLink>
            </div>
            <div className="search-products-grid">
              {nodes.map((product) => {
                const productUrl = urlWithTrackingParams({
                  baseUrl: `/products/${product.handle}`,
                  trackingParams: product.trackingParameters,
                  term,
                });

                const price = product?.selectedOrFirstAvailableVariant?.price;
                const image = product?.selectedOrFirstAvailableVariant?.image;

                return (
                  <Link
                    key={product.id}
                    prefetch="intent"
                    to={productUrl}
                    className="search-product-card"
                  >
                    <div className="search-product-card__image">
                      {image ? (
                        <Image
                          data={image}
                          alt={product.title}
                          aspectRatio="3/4"
                          sizes="(min-width: 768px) 20vw, 50vw"
                        />
                      ) : (
                        <div className="search-product-card__image-placeholder" />
                      )}
                    </div>
                    <div className="search-product-card__info">
                      <p className="search-product-card__title">{product.title}</p>
                      {price && (
                        <span className="search-product-card__price">
                          <Money data={price} />
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="search-pagination-link">
              <NextLink>
                {isLoading ? 'Loading…' : <span className="search-pagination-btn">Load more ↓</span>}
              </NextLink>
            </div>
          </div>
        )}
      </Pagination>
    </section>
  );
}

function SearchResultsEmpty() {
  return (
    <div className="search-empty">
      <p className="search-empty__text">No results found.</p>
      <p className="search-empty__sub">Try a different term or browse our collections.</p>
    </div>
  );
}
