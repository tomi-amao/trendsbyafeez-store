import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  CollectionItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

export function ProductItem({
  product,
  loading,
}: {
  product:
    | CollectionItemFragment
    | ProductItemFragment
    | RecommendedProductFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  return (
    <Link
      className="product-card"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      <div className="product-card__image">
        {image && (
          <Image
            alt={image.altText || product.title}
            aspectRatio="3/4"
            data={image}
            loading={loading}
            sizes="(min-width: 768px) 25vw, 50vw"
          />
        )}
      </div>
      <div className="product-card__info">
        <h4 className="product-card__title">{product.title}</h4>
        <span className="product-card__price">
          <Money data={product.priceRange.minVariantPrice} />
        </span>
      </div>
    </Link>
  );
}
