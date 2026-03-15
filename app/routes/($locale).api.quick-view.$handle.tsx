import type {Route} from './+types/api.quick-view.$handle';
import {data} from 'react-router';

export async function loader({params, context}: Route.LoaderArgs) {
  const {handle} = params;
  if (!handle) {
    throw new Response('Not found', {status: 404});
  }

  const {product} = await context.storefront.query(QUICK_VIEW_QUERY, {
    variables: {handle},
  });

  if (!product) {
    throw new Response('Not found', {status: 404});
  }

  return data({product});
}

const QUICK_VIEW_QUERY = `#graphql
  query QuickView(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      availableForSale
      vendor
      featuredImage {
        id
        url
        altText
        width
        height
      }
      images(first: 12) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      options {
        name
        optionValues {
          name
        }
      }
      variants(first: 50) {
        nodes {
          id
          title
          availableForSale
          selectedOptions {
            name
            value
          }
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;
