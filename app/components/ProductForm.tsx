import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

export function ProductForm({
  productOptions,
  selectedVariant,
  onSizeChartClick,
  comingSoon = false,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  onSizeChartClick?: () => void;
  comingSoon?: boolean;
}) {
  const navigate = useNavigate();
  const {open} = useAside();

  // Check if any size option is selected
  const sizeOption = productOptions.find(
    (opt) => opt.name.toLowerCase() === 'size',
  );
  const hasSizeSelected = sizeOption?.optionValues.some((v) => v.selected);

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        if (option.optionValues.length === 1) return null;

        const isSize = option.name.toLowerCase() === 'size';
        const isColor = option.name.toLowerCase() === 'color' || option.name.toLowerCase() === 'colour';

        return (
          <div className="product-options" key={option.name}>
            <div className="product-options__header">
              <h5>{option.name}</h5>
              {isSize && onSizeChartClick && (
                <button
                  type="button"
                  className="product-options__size-chart"
                  onClick={onSizeChartClick}
                >
                  View size chart +
                </button>
              )}
            </div>
            <div className={`product-options-grid ${isColor ? 'product-options-grid--color' : ''} ${isSize ? 'product-options-grid--size' : ''}`}>
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                const itemClass = isColor
                  ? 'product-options-item product-options-item--color'
                  : isSize
                  ? 'product-options-item product-options-item--size'
                  : 'product-options-item';

                if (isDifferentProduct) {
                  return (
                    <Link
                      className={`${itemClass}${selected ? ' product-options-item--selected' : ''}${!available ? ' product-options-item--unavailable' : ''}`}
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} isColor={isColor} />
                    </Link>
                  );
                } else {
                  return (
                    <button
                      type="button"
                      className={`${itemClass}${selected ? ' product-options-item--selected' : ''}${!available ? ' product-options-item--unavailable' : ''}${exists && !selected ? ' link' : ''}`}
                      key={option.name + name}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} isColor={isColor} />
                    </button>
                  );
                }
              })}
            </div>
          </div>
        );
      })}
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          open('cart');
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  selectedVariant,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale
          ? hasSizeSelected === false && sizeOption
            ? 'Select a size'
            : 'Add to cart'
          : comingSoon
            ? 'Coming soon'
            : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptionSwatch({
  swatch,
  name,
  isColor,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
  isColor?: boolean;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (isColor && (image || color)) {
    return (
      <div
        aria-label={name}
        className="product-option-swatch"
        style={{
          backgroundColor: color || 'transparent',
        }}
      >
        {!!image && <img src={image} alt={name} />}
      </div>
    );
  }

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}
