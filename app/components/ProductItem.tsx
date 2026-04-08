import {Link, useFetcher} from 'react-router';
import {Image, Money, CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useState, useEffect, useCallback, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {
  ProductItemFragment,
  CollectionItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

interface QvImage {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}

interface QuickViewProduct {
  id: string;
  title: string;
  handle: string;
  availableForSale: boolean;
  vendor?: string | null;
  featuredImage?: QvImage | null;
  images: {nodes: QvImage[]};
  priceRange: {
    minVariantPrice: {amount: string; currencyCode: string};
  };
  options: Array<{name: string; optionValues: Array<{name: string}>}>;
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      availableForSale: boolean;
      selectedOptions: Array<{name: string; value: string}>;
      price: {amount: string; currencyCode: string};
    }>;
  };
}

type ProductCardProduct =
  | CollectionItemFragment
  | ProductItemFragment
  | RecommendedProductFragment;

// Extended type to access optional fields added to queries (run codegen after)
type ProductWithExtras = ProductCardProduct & {
  totalInventory?: number | null;
  images?: {nodes: QvImage[]} | null;
  tags?: string[];
};

const LOW_STOCK_THRESHOLD = 5;

function getAvailability(product: ProductCardProduct): boolean {
  if ('availableForSale' in product) return product.availableForSale as boolean;
  return true;
}

function getTotalInventory(product: ProductCardProduct): number | null {
  const p = product as ProductWithExtras;

  return typeof p.totalInventory === 'number' ? p.totalInventory : null;
}

function getSecondImage(product: ProductCardProduct): QvImage | null {
  const p = product as ProductWithExtras;
  const nodes = p.images?.nodes;
  return nodes && nodes.length > 1 ? nodes[1] : null;
}

function isComingSoon(product: ProductCardProduct): boolean {
  const p = product as ProductWithExtras;
  return p.tags?.some((t) => t.toUpperCase() === 'COMING_SOON') ?? false;
}

export function ProductItem({
  product,
  loading,
}: {
  product: ProductCardProduct;
  loading?: 'eager' | 'lazy';
}) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const available = getAvailability(product);
  const comingSoon = isComingSoon(product);
  const inventory = getTotalInventory(product);
  const isLowStock = inventory !== null && inventory > 0 && inventory <= LOW_STOCK_THRESHOLD;
  const secondImage = getSecondImage(product);

  const openQuickView = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewOpen(true);
  }, []);

  const closeQuickView = useCallback(() => setQuickViewOpen(false), []);

  useEffect(() => {
    if (!quickViewOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickView();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [quickViewOpen, closeQuickView]);

  return (
    <>
      <div className={`product-card-wrapper${!available ? (comingSoon ? ' product-card-wrapper--coming-soon' : ' product-card-wrapper--sold-out') : ''}`}>
        {/* Image area with overlaid controls */}
        <div className="product-card__fig">
          <Link className="product-card" prefetch="intent" to={variantUrl} tabIndex={-1} aria-hidden="true">
            <div className={`product-card__image${secondImage ? ' product-card__image--has-hover' : ''}`}>
              {image && (
                <Image
                  className="product-card__image-primary"
                  alt={image.altText || product.title}
                  aspectRatio="3/4"
                  data={image}
                  loading={loading}
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
              )}
              {secondImage && (
                <Image
                  className="product-card__image-hover"
                  alt={secondImage.altText || product.title}
                  aspectRatio="3/4"
                  data={secondImage}
                  loading="lazy"
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
              )}
              {!available && (
                <div className={`product-card__sold-out-badge${comingSoon ? ' product-card__sold-out-badge--coming-soon' : ''}`} aria-label={comingSoon ? 'Coming soon' : 'Sold out'}>
                  <span>{comingSoon ? 'Coming Soon' : 'Sold Out'}</span>
                </div>
              )}
              {/* {available && isLowStock && (
                <div className="product-card__low-stock-badge" aria-label={`Only ${inventory} left`}>
                  <span>Only {inventory} left</span>
                </div>
              )} */}
            </div>
          </Link>
          {/* Quick View — desktop hover */}
          <button
            className="product-card__quickview"
            onClick={openQuickView}
            aria-label={`Quick view ${product.title}`}
          >
            Quick View
          </button>
          {/* Add button — mobile only */}
          <button
            className="product-card__mobile-add"
            onClick={openQuickView}
            aria-label={`Quick view ${product.title}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Product info — separate focusable link */}
        <Link className="product-card__info" prefetch="intent" to={variantUrl}>
          <h4 className="product-card__title">{product.title}</h4>
          <span className="product-card__price">
            <Money data={product.priceRange.minVariantPrice} />
          </span>
          {/* {available && isLowStock && (
            <span className="product-card__low-stock-text" aria-live="polite">
              Only {inventory} left
            </span>
          )} */}
        </Link>
      </div>

      {quickViewOpen && typeof document !== 'undefined' &&
        createPortal(
          <QuickViewPanel
            handle={product.handle}
            variantUrl={variantUrl}
            onClose={closeQuickView}
            comingSoon={comingSoon}
          />,
          document.body,
        )}
    </>
  );
}

/* ─── Quick View Panel (sidebar desktop / bottom sheet mobile) ─── */
function QuickViewPanel({
  handle,
  variantUrl,
  onClose,
  comingSoon,
}: {
  handle: string;
  variantUrl: string;
  onClose: () => void;
  comingSoon: boolean;
}) {
  const fetcher = useFetcher<{product: QuickViewProduct}>();
  const cartFetcher = useFetcher({key: `qv-cart-${handle}`});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cartWasSubmitting = useRef(false);

  useEffect(() => {
    if (cartFetcher.state !== 'idle') {
      cartWasSubmitting.current = true;
    } else if (cartWasSubmitting.current) {
      cartWasSubmitting.current = false;
      setAddedToCart(true);
      const t = setTimeout(() => setAddedToCart(false), 2000);
      return () => clearTimeout(t);
    }
  }, [cartFetcher.state]);

  useEffect(() => {
    fetcher.load(`/api/quick-view/${handle}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const product = fetcher.data?.product;
  const loading = fetcher.state === 'loading';

  useEffect(() => {
    if (!product) return;
    const initial: Record<string, string> = {};
    product.options.forEach((opt) => {
      if (opt.optionValues.length > 0) {
        initial[opt.name] = opt.optionValues[0].name;
      }
    });
    setSelectedOptions(initial);
  }, [product]);

  const selectedVariant =
    product?.variants.nodes.find((v) =>
      v.selectedOptions.every((opt) => selectedOptions[opt.name] === opt.value),
    ) ?? product?.variants.nodes[0];

  const isVariantAvailable = selectedVariant?.availableForSale ?? false;

  // Build gallery: prefer images array, fall back to featuredImage
  const qvImages: QvImage[] =
    product?.images?.nodes?.length
      ? product.images.nodes
      : product?.featuredImage
        ? [product.featuredImage]
        : [];
  const clampedIdx = Math.min(activeImgIdx, Math.max(0, qvImages.length - 1));
  const qvActiveImg = qvImages[clampedIdx];

  return (
    <>
      <div className="quickview-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="quickview-panel"
        role="dialog"
        aria-modal="true"
        aria-label={product ? `Quick view: ${product.title}` : 'Quick view'}
      >
        <button className="quickview-panel__close" onClick={onClose} aria-label="Close quick view">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {loading ? (
          <div className="quickview-panel__loading">
            <div className="quickview-panel__spinner" />
          </div>
        ) : product ? (
          <div className="quickview-panel__inner">
            {qvImages.length > 0 && (
              <div
                className="quickview-panel__image"
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(dx) < 30) return;
                  if (dx < 0) setActiveImgIdx((n) => (n + 1) % qvImages.length);
                  else setActiveImgIdx((n) => (n - 1 + qvImages.length) % qvImages.length);
                }}
              >
                {qvActiveImg && (
                  <Image
                    alt={qvActiveImg.altText || product.title}
                    data={qvActiveImg}
                    sizes="(min-width: 768px) 400px, 100vw"
                    loading="eager"
                  />
                )}
                {qvImages.length > 1 && (
                  <>
                    <button
                      className="quickview-panel__img-prev"
                      onClick={() =>
                        setActiveImgIdx(
                          (n) => (n - 1 + qvImages.length) % qvImages.length,
                        )
                      }
                      aria-label="Previous image"
                    >
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                        <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      className="quickview-panel__img-next"
                      onClick={() =>
                        setActiveImgIdx((n) => (n + 1) % qvImages.length)
                      }
                      aria-label="Next image"
                    >
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                        <path d="M1 1L7 7L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="quickview-panel__img-dots" aria-hidden="true">
                      {qvImages.map((_, i) => (
                        <button
                          key={i}
                          className={`quickview-panel__img-dot${i === clampedIdx ? ' quickview-panel__img-dot--active' : ''}`}
                          onClick={() => setActiveImgIdx(i)}
                          aria-label={`View image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="quickview-panel__info">
              {product.vendor && (
                <p className="quickview-panel__vendor">{product.vendor}</p>
              )}
              <h2 className="quickview-panel__title">{product.title}</h2>
              <p className="quickview-panel__price">
                <Money data={(selectedVariant?.price ?? product.priceRange.minVariantPrice) as any} />
              </p>

              {product.options.map((opt) => {
                if (opt.optionValues.length <= 1) return null;
                const optionVariants = opt.optionValues.map((v) => {
                  const match = product.variants.nodes.find((variant) =>
                    variant.selectedOptions.some(
                      (sel) => sel.name === opt.name && sel.value === v.name,
                    ),
                  );
                  return {name: v.name, available: match?.availableForSale ?? false};
                });
                return (
                  <div className="quickview-panel__option" key={opt.name}>
                    <p className="quickview-panel__option-label">
                      {opt.name}
                      {selectedOptions[opt.name] && (
                        <span className="quickview-panel__option-selected">
                          {' '}&mdash; {selectedOptions[opt.name]}
                        </span>
                      )}
                    </p>
                    <div className="quickview-panel__option-values">
                      {optionVariants.map(({name, available}) => (
                        <button
                          key={name}
                          type="button"
                          className={`quickview-panel__opt-btn${
                            selectedOptions[opt.name] === name
                              ? ' quickview-panel__opt-btn--selected'
                              : ''
                          }${!available ? ' quickview-panel__opt-btn--unavailable' : ''}`}
                          onClick={() =>
                            setSelectedOptions((prev) => ({...prev, [opt.name]: name}))
                          }
                          disabled={!available}
                          aria-pressed={selectedOptions[opt.name] === name}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {selectedVariant && (
                <CartForm
                  fetcherKey={`qv-cart-${handle}`}
                  route="/cart"
                  inputs={{
                    lines: [
                      {
                        merchandiseId: selectedVariant.id,
                        quantity: 1,
                      } satisfies OptimisticCartLineInput,
                    ],
                  }}
                  action={CartForm.ACTIONS.LinesAdd}
                >
                  {() => (
                    <button
                      type="submit"
                      className={`quickview-panel__add-to-cart${addedToCart ? ' quickview-panel__add-to-cart--added' : ''}`}
                      disabled={!isVariantAvailable || cartFetcher.state !== 'idle'}
                    >
                      {addedToCart
                        ? 'Added to Cart'
                        : isVariantAvailable
                          ? 'Add to Cart'
                          : comingSoon
                            ? 'Coming Soon'
                            : 'Sold Out'}
                    </button>
                  )}
                </CartForm>
              )}

              <Link
                to={variantUrl}
                className="quickview-panel__view-details"
                prefetch="intent"
                onClick={onClose}
              >
                View Full Details
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5H8M5 2L8 5L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="quickview-panel__error">
            <p>Unable to load product details.</p>
            <Link to={variantUrl} className="quickview-panel__view-details" onClick={onClose}>
              View product page →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
