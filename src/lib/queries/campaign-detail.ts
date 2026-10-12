import { connection } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toCampaignView, type CampaignRow, type CampaignStats } from "@/lib/campaign";
import type { CampaignDetail, DetailItem } from "@/lib/pricing";

type RawAddonValue = {
  id: string; label: string; price: number; is_default: boolean;
  is_quote_required: boolean; sort_order: number; is_active: boolean;
};
type RawAddonGroup = {
  id: string; name: string; select_type: "single" | "multi"; ui_type: string;
  is_required: boolean; sort_order: number; addon_values: RawAddonValue[];
};
type RawSkuLink = {
  price_adjustment: number;
  is_default: boolean;
  sku: {
    id: string; sku: string; attributes: Record<string, string>; image_url: string | null;
    status: string; sort_order: number;
    model: {
      id: string; model_code: string; model_name: string; image_url: string | null;
      sort_order: number; status: string;
    } | null;
  } | null;
};
type RawItem = {
  id: string; label: string; is_required: boolean; optional_price: number;
  quantity: number; sort_order: number;
  product: {
    id: string; name: string; product_type: string; attribute_keys: string[];
    addon_groups: RawAddonGroup[];
  } | null;
  package_item_skus: RawSkuLink[];
};
type RawDetail = CampaignRow & {
  per_user_limit: number;
  package: CampaignRow["package"] & {
    description: string | null;
    images: string[];
    product_code: string | null;
    package_items: RawItem[];
  };
};

const DETAIL_SELECT = `
  id, name, slug, start_at, end_at, target_participants, max_quantity, per_user_limit,
  campaign_price, closing_soon_hours, manual_state,
  package:packages!inner(
    id, name, slug, summary, description, images, product_code, list_price, thumbnail_url, status,
    brand:brands!inner(name, slug, theme_color),
    category:categories!inner(name, slug),
    package_items(
      id, label, is_required, optional_price, quantity, sort_order,
      product:products(
        id, name, product_type, attribute_keys,
        addon_groups(
          id, name, select_type, ui_type, is_required, sort_order,
          addon_values(id, label, price, is_default, is_quote_required, sort_order, is_active)
        )
      ),
      package_item_skus(
        price_adjustment, is_default,
        sku:product_skus(
          id, sku, attributes, image_url, status, sort_order,
          model:product_models(id, model_code, model_name, image_url, sort_order, status)
        )
      )
    )
  )
`;

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/** 공동구매 상세 (서버 전용). client를 넘기면 해당 클라이언트로 조회 */
export async function getCampaignDetail(
  slug: string,
  client?: SupabaseClient
): Promise<CampaignDetail | null> {
  await connection();
  const sb = client ?? publicClient();

  const { data, error } = await sb
    .from("campaigns")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_visible", true)
    .eq("package.status", "active")
    .maybeSingle();
  if (error) throw new Error(`상세 조회 실패: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as RawDetail;
  const rawItems = [...(row.package.package_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const skuIds = rawItems.flatMap((i) =>
    i.package_item_skus.map((l) => l.sku?.id).filter((x): x is string => !!x)
  );

  const [statsRes, availRes] = await Promise.all([
    sb.from("campaign_stats").select("*").eq("campaign_id", row.id).maybeSingle(),
    skuIds.length
      ? sb.from("sku_availability").select("sku_id, available").in("sku_id", skuIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (statsRes.error) throw new Error(`집계 조회 실패: ${statsRes.error.message}`);
  if (availRes.error) throw new Error(`재고 조회 실패: ${availRes.error.message}`);

  const availMap = new Map(
    ((availRes.data ?? []) as { sku_id: string; available: number }[]).map((a) => [a.sku_id, a.available])
  );

  const items: DetailItem[] = rawItems.map((ri) => {
    const links = ri.package_item_skus.filter(
      (l) => l.sku && l.sku.status !== "inactive" && l.sku.model && l.sku.model.status === "active"
    );

    const modelMap = new Map<string, DetailItem["models"][number]>();
    for (const l of links) {
      const m = l.sku!.model!;
      modelMap.set(m.id, {
        id: m.id,
        code: m.model_code,
        name: m.model_name,
        imageUrl: m.image_url,
        sortOrder: m.sort_order,
      });
    }

    return {
      id: ri.id,
      label: ri.label,
      isRequired: ri.is_required,
      optionalPrice: ri.optional_price,
      quantity: ri.quantity,
      productName: ri.product?.name ?? ri.label,
      productType: ri.product?.product_type ?? "",
      attributeKeys: ri.product?.attribute_keys ?? [],
      models: [...modelMap.values()].sort((a, b) => a.sortOrder - b.sortOrder),
      skus: links
        .sort((a, b) => a.sku!.sort_order - b.sku!.sort_order)
        .map((l) => ({
          id: l.sku!.id,
          sku: l.sku!.sku,
          modelId: l.sku!.model!.id,
          attributes: l.sku!.attributes ?? {},
          imageUrl: l.sku!.image_url,
          adjustment: l.price_adjustment,
          isDefault: l.is_default,
          available: l.sku!.status === "active" ? availMap.get(l.sku!.id) ?? 0 : 0,
        })),
      addonGroups: (ri.product?.addon_groups ?? [])
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
            .map((v) => ({
              id: v.id,
              label: v.label,
              price: v.price,
              isDefault: v.is_default,
              isQuoteRequired: v.is_quote_required,
            })),
        }))
        .filter((g) => g.values.length > 0),
    };
  });

  const serverNow = Date.now();
  const images = [row.package.thumbnail_url, ...(row.package.images ?? [])].filter(
    (x, i, arr): x is string => !!x && arr.indexOf(x) === i
  );

  return {
    campaign: toCampaignView(row, (statsRes.data as CampaignStats) ?? undefined, serverNow),
    perUserLimit: row.per_user_limit,
    productCode: row.package.product_code,
    description: row.package.description,
    images,
    items,
    serverNow,
  };
}
