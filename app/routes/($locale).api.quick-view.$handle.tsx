import type {Route} from './+types/api.quick-view.$handle';
import {data} from 'react-router';

type StoqPlanLike = {
  id?: string | number;
  enabled?: boolean | string | number | null;
  shopify_selling_plan_id?: string;
  shopify_selling_plan_group_id?: string | number;
  preorder_button_text?: string;
  delivery_exact_time?: string;
  shipping_text?: string;
  billing_checkout_charge_type?: string;
  billing_checkout_charge_value?: string | number;
  billing_checkout_charge_percentage?: string | number;
};

type QuickViewPreorderConfig = {
  isPreorder: boolean;
  sellingPlanId?: string;
  buttonText?: string;
  estimatedShipText?: string;
  depositPercentage?: number | null;
};

function parseJsonSafe(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseVariantPlanIds(value: string | null | undefined): string[] {
  if (!value) return [];

  const normalizeIdEntry = (entry: unknown): string | null => {
    if (entry == null) return null;

    if (typeof entry === 'string' || typeof entry === 'number') {
      const v = String(entry).trim();
      return v || null;
    }

    if (typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const candidate =
        obj.id ??
        obj.selling_plan_id ??
        obj.sellingPlanId ??
        obj.shopify_selling_plan_id ??
        obj.shopify_selling_plan_group_id ??
        obj.selling_plan_group_id;

      if (candidate == null) return null;
      const v = String(candidate).trim();
      return v || null;
    }

    return null;
  };

  const parsed = parseJsonSafe(value);
  if (Array.isArray(parsed)) {
    return parsed
      .map((v) => normalizeIdEntry(v))
      .filter((v): v is string => !!v);
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidate =
      obj.selling_plan_ids ??
      obj.sellingPlanIds ??
      obj.plan_ids ??
      obj.ids ??
      obj.id;

    if (Array.isArray(candidate)) {
      return candidate
        .map((v) => normalizeIdEntry(v))
        .filter((v): v is string => !!v);
    }
    if (candidate != null) {
      const normalized = normalizeIdEntry(candidate);
      return normalized ? [normalized] : [];
    }
  }

  if (typeof value === 'string' && value.includes(',')) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return value ? [String(value)] : [];
}

function extractStoqPlans(raw: unknown): StoqPlanLike[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter((p): p is StoqPlanLike => !!p && typeof p === 'object');
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.selling_plans)) {
      return obj.selling_plans.filter(
        (p): p is StoqPlanLike => !!p && typeof p === 'object',
      );
    }
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isEnabledFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function idTokens(raw: unknown): string[] {
  if (raw == null) return [];
  const value = String(raw).trim();
  if (!value) return [];

  const tokens = new Set<string>([value]);

  const sellingPlanMatch = value.match(/^gid:\/\/shopify\/SellingPlan\/(\d+)$/);
  if (sellingPlanMatch?.[1]) tokens.add(sellingPlanMatch[1]);

  const sellingPlanGroupMatch = value.match(
    /^gid:\/\/shopify\/SellingPlanGroup\/(\d+)$/,
  );
  if (sellingPlanGroupMatch?.[1]) tokens.add(sellingPlanGroupMatch[1]);

  if (/^\d+$/.test(value)) {
    tokens.add(`gid://shopify/SellingPlan/${value}`);
    tokens.add(`gid://shopify/SellingPlanGroup/${value}`);
  }

  return [...tokens];
}

function planMatchTokens(plan: StoqPlanLike): string[] {
  return [
    ...idTokens(plan.id),
    ...idTokens(plan.shopify_selling_plan_id),
    ...idTokens(plan.shopify_selling_plan_group_id),
  ];
}

function variantNumericId(variantId: unknown): string | null {
  const value = String(variantId ?? '');
  const match = value.match(/ProductVariant\/(\d+)$/);
  return match?.[1] ?? null;
}

function planVariantIds(plan: StoqPlanLike): string[] {
  const raw = (plan as any)?.variant_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id)).filter(Boolean);
}

function toSellingPlanGid(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;

  if (/^gid:\/\/shopify\/SellingPlan\/\d+$/.test(value)) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/SellingPlan/${value}`;

  return undefined;
}

function getVariantPreorderConfig(
  selectedVariant: any,
  stoqPlans: StoqPlanLike[],
): QuickViewPreorderConfig {
  if (!selectedVariant) return {isPreorder: false};

  const variantPlanIds = parseVariantPlanIds(
    selectedVariant?.stoqSellingPlanIds?.value,
  );

  const variantTokenSet = new Set(variantPlanIds.flatMap((id) => idTokens(id)));
  const selectedVariantNumericId = variantNumericId(selectedVariant?.id);
  const allocationTokenSet = new Set(
    ((selectedVariant?.sellingPlanAllocations?.nodes ?? []) as any[])
      .flatMap((node) => idTokens(node?.sellingPlan?.id))
      .filter(Boolean),
  );

  const matchedEnabledPlan = stoqPlans.find((plan) => {
    if (!isEnabledFlag(plan.enabled)) return false;

    const tokens = planMatchTokens(plan);
    if (tokens.some((token) => variantTokenSet.has(token))) return true;

    const stoqVariantIds = planVariantIds(plan);
    if (
      selectedVariantNumericId &&
      stoqVariantIds.includes(selectedVariantNumericId)
    ) {
      return true;
    }

    if (tokens.some((token) => allocationTokenSet.has(token))) return true;

    return false;
  });

  if (!matchedEnabledPlan) return {isPreorder: false};

  const allocationSellingPlanId = selectedVariant?.sellingPlanAllocations?.nodes?.[0]?.sellingPlan?.id as
    | string
    | undefined;
  const sellingPlanId =
    toSellingPlanGid(matchedEnabledPlan.shopify_selling_plan_id) ||
    allocationSellingPlanId;

  const depositPercentage =
    matchedEnabledPlan.billing_checkout_charge_type === 'percentage'
      ? toNumber(
          matchedEnabledPlan.billing_checkout_charge_percentage ??
            matchedEnabledPlan.billing_checkout_charge_value,
        )
      : null;

  return {
    isPreorder: true,
    sellingPlanId,
    buttonText: matchedEnabledPlan.preorder_button_text,
    estimatedShipText:
      matchedEnabledPlan.delivery_exact_time || matchedEnabledPlan.shipping_text,
    depositPercentage,
  };
}

export async function loader({params, context}: Route.LoaderArgs) {
  const {handle} = params;
  if (!handle) {
    throw new Response('Not found', {status: 404});
  }

  const {product, shop} = await context.storefront.query(QUICK_VIEW_QUERY, {
    variables: {handle},
    cache: context.storefront.CacheShort(),
  });

  if (!product) {
    throw new Response('Not found', {status: 404});
  }

  const stoqPlans = extractStoqPlans(parseJsonSafe(shop?.stoqSellingPlans?.value));
  const preorderByVariantId = ((product.variants?.nodes ?? []) as any[]).reduce(
    (acc, variant) => {
      const config = getVariantPreorderConfig(variant, stoqPlans);
      if (config.isPreorder && variant?.id) {
        acc[String(variant.id)] = config;
      }
      return acc;
    },
    {} as Record<string, QuickViewPreorderConfig>,
  );

  return data({product, preorderByVariantId});
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
          stoqSellingPlanIds: metafield(namespace: "restockrocket_production", key: "selling_plan_ids") {
            value
          }
          sellingPlanAllocations(first: 20) {
            nodes {
              sellingPlan {
                id
                name
              }
            }
          }
        }
      }
    }
    shop {
      stoqSellingPlans: metafield(namespace: "restockrocket_production", key: "selling_plans") {
        value
      }
    }
  }
` as const;
