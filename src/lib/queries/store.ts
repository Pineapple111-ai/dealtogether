import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicClient } from "@/lib/supabase/public";
import type { DetailAddonGroup, DetailModel } from "@/lib/pricing";
import type { DiscountRule } from "@/lib/store";

export type StoreSku = {
  id: string;
  sku: string;
  modelId: string;
  attributes: Record<string, string>;
  imageUrl: string | null;
  listPrice: number;
  salePrice: number;
  available: number;
};

export type StoreProduct = {
  id: string;
  name: string;
  productType: string;
  category: string;
  brand: { name: string; slug: string; theme_color: string | null };
  thumbnail: string | null;
  summary: string | null;
  description: string | null;
  bundleEligible: boolean;
  attributeKeys: string[];
  models: DetailModel[];
  skus: StoreSku[];
  addonGroups: DetailAddonGroup[];
  minPrice: number;
  minListPrice: number;
  maxDiscountRate: number;
  inStock: boolean;
  createdAt: string;
};

type RawPrice = { list_price: number; sale_price: number; is_active: boolean };
type RawProduct = {
  id: string; name: string; product_type: string; description: string | null; attribute_keys: string[];
  store_category: string; store_thumbnail: string | null; store_summary: string | null; bundle_eligible: boolean;
  created_at: string;
  brand: { name: string; slug: string; theme_color: string | null };
  product_models: {
    id: string; model_code: string; model_name: string; image_url: string | null; sort_order: number; status: string;
    product_skus: {
      id: string; sku: string; attributes: Record<string, string>; image_url: string | null; status: string; sort_order: number;
      store_prices: RawPrice | RawPrice[] | null;
    }[];
  }[];
  addon_groups: {
    id: string; name: string; select_type: "single" | "multi"; ui_type: string; is_required: boolean; sort_order: number;
    addon_values: { id: string; label: string; price: number; is_default: boolean; is_quote_required: boolean; sort_order: number; is_active: boolean }[];
  }[];
};

const SELECT = `
  id, name, product_type, description, attribute_keys, store_category, store_thumbnail, store_summary, bundle_eligible, created_at,
  brand:brands!inner(name, slug, theme_color),
  product_models(id, model_code, model_name, image_url, sort_order, status,
    product_skus(id, sku, attributes, image_url, status, sort_order, store_prices(list_price, sale_price, is_active))),
  addon_groups(id, name, select_type, ui_type, is_required, sort_order,
    addon_values(id, label, price, is_default, is_quote_required, sort_order, is_active))
`;

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

function toStoreProduct(r: RawProduct, avail: Map<string, number>): StoreProduct | null {
  const models = r.product_models.filter((m) => m.status === "active").sort((a, b) => a.sort_order - b.sort_order);
  const skus: StoreSku[] = [];
  for (const m of models) {
    for (const s of [...m.product_skus].sort((a, b) => a.sort_order - b.sort_order)) {
      const price = one(s.store_prices);
      if (!price || !price.is_active || s.status === "inactive") continue;
      skus.push({
        id: s.id,
        sku: s.sku,
        modelId: m.id,
        attributes: s.attributes ?? {},
        imageUrl: s.image_url,
        listPrice: price.list_price,
        salePrice: price.sale_price,
        available: s.status === "active" ? avail.get(s.id) ?? 0 : 0,
      });
    }
  }
  if (skus.length === 0) return null;

  const usedModels = models.filter((m) => skus.some((s) => s.modelId === m.id));
  const cheapest = [...skus].sort((a, b) => a.salePrice - b.salePrice)[0];

  return {
    id: r.id,
    name: r.name,
    productType: r.product_type,
    category: r.store_category,
    brand: r.brand,
    thumbnail: r.store_thumbnail ?? usedModels.find((m) => m.image_url)?.image_url ?? null,
    summary: r.store_summary,
    description: r.description,
    bundleEligible: r.bundle_eligible,
    attributeKeys: r.attribute_keys ?? [],
    models: usedModels.map((m) => ({ id: m.id, code: m.model_code, name: m.model_name, imageUrl: m.image_url, sortOrder: m.sort_order })),
    skus,
    addonGroups: r.addon_groups
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        id: g.id,
        name: g.name,
        selectType: g.select_type,
        uiType: g.ui_type,
        isRequired: g.is_required,
        values: g.addon_values
          .filter((v) => v.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, label: v.label, price: v.price, isDefault: v.is_default, isQuoteRequired: v.is_quote_required })),
      }))
      .filter((g) => g.values.length > 0),
    minPrice: cheapest.salePrice,
    minListPrice: cheapest.listPrice,
    maxDiscountRate: Math.max(
      ...skus.map((s) => (s.listPrice > s.salePrice ? Math.floor(((s.listPrice - s.salePrice) / s.listPrice) * 100) : 0))
    ),
    inStock: skus.some((s) => s.available > 0),
    createdAt: r.created_at,
  };
}

async function load(sb: SupabaseClient, rows: RawProduct[]) {
  const skuIds = rows.flatMap((r) => r.product_models.flatMap((m) => m.product_skus.map((s) => s.id)));
  const { data } = skuIds.length
    ? await sb.from("sku_availability").select("sku_id, available").in("sku_id", skuIds)
    : { data: [] as { sku_id: string; available: number }[] };
  const avail = new Map((data ?? []).map((a) => [a.sku_id as string, a.available as number]));
  return rows.map((r) => toStoreProduct(r, avail)).filter((p): p is StoreProduct => !!p);
}

export async function getStoreProducts(opts: { category?: string; brand?: string } = {}) {
  await connection();
  const sb = publicClient();
  let q = sb.from("products").select(SELECT).eq("store_visible", true).eq("status", "active");
  if (opts.category) q = q.eq("store_category", opts.category);
  if (opts.brand) q = q.eq("brand.slug", opts.brand);
  const { data, error } = await q;
  if (error) throw new Error(`상품 조회 실패: ${error.message}`);
  return load(sb, (data ?? []) as unknown as RawProduct[]);
}

/** 상세 / 서버 검증용. client를 넘기면 해당 클라이언트로 조회 */
export async function getStoreProductsByIds(ids: string[], client?: SupabaseClient) {
  await connection();
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return [];
  const sb = client ?? publicClient();
  const { data, error } = await sb
    .from("products")
    .select(SELECT)
    .in("id", valid)
    .eq("store_visible", true)
    .eq("status", "active");
  if (error) throw new Error(`상품 조회 실패: ${error.message}`);
  return load(sb, (data ?? []) as unknown as RawProduct[]);
}

export async function getActiveDiscountRules(client?: SupabaseClient): Promise<DiscountRule[]> {
  const sb = client ?? publicClient();
  const { data } = await sb
    .from("discount_rules")
    .select("id, name, rule_type, tiers")
    .eq("is_active", true)
    .order("sort_order");
  return ((data ?? []) as DiscountRule[]).filter((r) => Array.isArray(r.tiers) && r.tiers.length > 0);
}