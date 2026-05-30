import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {Truck} from '@phosphor-icons/react';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

type PreorderConfig = {
  isPreorder: boolean;
  sellingPlanId?: string;
  badgeText?: string;
  badgeBackgroundColor?: string;
  badgeTextColor?: string;
  description?: string;
  buttonText?: string;
  estimatedShipText?: string;
  depositPercentage?: number | null;
};

const estimatedShipDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function formatEstimatedShipText(value?: string): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const dateParts = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (dateParts) {
    const [, yearRaw, monthRaw, dayRaw] = dateParts;
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return estimatedShipDateFormatter.format(new Date(year, month - 1, day));
    }
  }

  return trimmed;
}

export function ProductForm({
  productOptions,
  selectedVariant,
  onSizeChartClick,
  comingSoon = false,
  preorderConfig,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  onSizeChartClick?: () => void;
  comingSoon?: boolean;
  preorderConfig?: PreorderConfig;
}) {
  const navigate = useNavigate();
  const {open} = useAside();

  // Check if any size option is selected
  const sizeOption = productOptions.find(
    (opt) => opt.name.toLowerCase() === 'size',
  );
  const hasSizeSelected = sizeOption?.optionValues.some((v) => v.selected);
  const isPreorder = preorderConfig?.isPreorder === true;

  const buttonLabel = (() => {
    if (isPreorder) {
      if (hasSizeSelected === false && sizeOption) return 'Select a size';
      return preorderConfig?.buttonText || 'Pre-order';
    }

    if (selectedVariant?.availableForSale) {
      if (hasSizeSelected === false && sizeOption) return 'Select a size';
      return 'Add to cart';
    }

    return comingSoon ? 'Coming soon' : 'Sold out';
  })();

  const buttonDisabled = isPreorder
    ? !selectedVariant || (!!sizeOption && hasSizeSelected === false)
    : !selectedVariant || !selectedVariant.availableForSale;

  const depositText = (() => {
    if (typeof preorderConfig?.depositPercentage !== 'number') return null;

    if (preorderConfig.depositPercentage >= 100) {
      return '';
    }

    return `Pay ${preorderConfig.depositPercentage}% today, remainder on fulfillment`;
  })();
  const estimatedShipText = formatEstimatedShipText(
    preorderConfig?.estimatedShipText,
  );
  const lineAttributes =
    isPreorder && estimatedShipText
      ? [{key: 'Estimated ship date', value: estimatedShipText}]
      : undefined;

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

      {isPreorder && (
        <div className="product-preorder" aria-live="polite">
          {preorderConfig?.badgeText && (
            <span
              className="product-preorder__badge"
              style={{
                background: preorderConfig.badgeBackgroundColor || '#f4ead2',
                color: preorderConfig.badgeTextColor || '#111',
              }}
            >
              {preorderConfig.badgeText}
            </span>
          )}

          {preorderConfig?.description && (
            <p className="product-preorder__description">{preorderConfig.description}</p>
          )}

          {estimatedShipText && (
            <p className="product-preorder__eta">
              <Truck
                aria-hidden="true"
                className="product-preorder__eta-icon"
                size={14}
                weight="regular"
              />
              <span>Estimated ship date: {estimatedShipText}</span>
            </p>
          )}

          {depositText && <p className="product-preorder__deposit">{depositText}</p>}
        </div>
      )}

      <AddToCartButton
        className={isPreorder ? 'add-to-cart-button--preorder' : undefined}
        disabled={buttonDisabled}
        onClick={() => {
          open('cart');
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  ...(lineAttributes ? {attributes: lineAttributes} : {}),
                  ...(isPreorder && preorderConfig?.sellingPlanId
                    ? {sellingPlanId: preorderConfig.sellingPlanId}
                    : {}),
                  selectedVariant,
                },
              ]
            : []
        }
      >
        {buttonLabel}
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
