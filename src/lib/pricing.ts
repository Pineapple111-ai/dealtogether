import type { CampaignView } from "@/lib/campaign";

// ---------- 상세 데이터 타입 ----------
export type DetailSku = {
  id: string;
  sku: string;
  modelId: string;
  attributes: Record<string, string>;
  imageUrl: string | null;
  adjustment: number; // 패키지 기준 추가금 (단위당)
  isDefault: boolean;
  available: number; // 판매 가능 재고
  productId?: string; // SKU가 속한 제품 (구성품 기본 제품과 다를 수 있음)
  productName?: string;
  addonGroups?: DetailAddonGroup[]; // SKU 제품의 설치·부가 옵션
};

export type DetailModel = {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
};

export type DetailAddonValue = {
  id: string;
  label: string;
  price: number;
  isDefault: boolean;
  isQuoteRequired: boolean;
};

export type DetailAddonGroup = {
  id: string;
  name: string;
  selectType: "single" | "multi";
  uiType: string;
  isRequired: boolean;
  values: DetailAddonValue[];
};

export type DetailItem = {
  id: string;
  label: string;
  isRequired: boolean;
  optionalPrice: number;
  quantity: number;
  productName: string;
  productType: string;
  attributeKeys: string[];
  models: DetailModel[];
  skus: DetailSku[];
  addonGroups: DetailAddonGroup[];
};

export type CampaignDetail = {
  campaign: CampaignView;
  perUserLimit: number;
  productCode: string | null;
  description: string | null;
  images: string[];
  items: DetailItem[];
  serverNow: number;
};

// ---------- 선택 ----------
export type ItemSelection = {
  included: boolean;
  skuId: string | null;
  addons: Record<string, string[]>;
};

export type Selection = {
  quantity: number;
  items: Record<string, ItemSelection>;
};

// ---------- 견적 ----------
export type QuoteLine = {
  packageItemId: string;
  skuId: string;
  isOptional: boolean;
  itemLabel: string;
  productName: string;
  modelCode: string;
  modelName: string;
  skuCode: string;
  attributes: Record<string, string>;
  addons: { group: string; label: string; price: number }[];
  quantity: number;
  itemPrice: number;
  skuAdjustment: number;
  addonTotal: number;
};

export type Quote = {
  quantity: number;
  basePrice: number;
  optionTotal: number;
  optionalItemTotal: number;
  installationFee: number;
  shippingFee: number;
  discountTotal: number;
  grandTotal: number;
  listTotal: number;
  quoteRequired: boolean;
  lines: QuoteLine[];
};

/** 선택한 SKU 기준 옵션 그룹 (SKU 제품 옵션이 있으면 그것, 없으면 구성품 기본 제품 옵션) */
export function groupsFor(item: DetailItem, sku?: DetailSku | null): DetailAddonGroup[] {
  return sku?.addonGroups ?? item.addonGroups;
}

/** 옵션 기본 선택값 */
export function defaultAddons(groups: DetailAddonGroup[]): Record<string, string[]> {
  const addons: Record<string, string[]> = {};
  for (const g of groups) {
    const defaults = g.values.filter((v) => v.isDefault).map((v) => v.id);
    if (g.selectType === "single") {
      const pick = defaults[0] ?? (g.isRequired ? g.values[0]?.id : undefined);
      addons[g.id] = pick ? [pick] : [];
    } else {
      addons[g.id] = defaults;
    }
  }
  return addons;
}

export function maxPurchasable(d: CampaignDetail) {
  return Math.max(Math.min(d.perUserLimit, d.campaign.remaining), 0);
}

/** 기본 선택값 */
export function defaultSelection(d: CampaignDetail): Selection {
  const items: Record<string, ItemSelection> = {};
  for (const item of d.items) {
    const sku =
      item.skus.find((s) => s.isDefault && s.available >= item.quantity) ??
      item.skus.find((s) => s.available >= item.quantity) ??
      item.skus.find((s) => s.isDefault) ??
      item.skus[0];
    items[item.id] = {
      included: item.isRequired,
      skuId: sku?.id ?? null,
      addons: defaultAddons(groupsFor(item, sku)),
    };
  }
  return { quantity: 1, items };
}

/** 견적 계산 + 검증 (클라이언트 표시 / 서버 검증 공용) */
export function computeQuote(d: CampaignDetail, sel: Selection): { ok: boolean; errors: string[]; quote: Quote } {
  const errors: string[] = [];
  const c = d.campaign;
  const rawQty = Number(sel?.quantity);

  if (!c.isPurchasable) errors.push("현재 구매할 수 없는 공동구매입니다.");
  if (!Number.isInteger(rawQty) || rawQty < 1) errors.push("수량을 확인해주세요.");
  else if (rawQty > d.perUserLimit) errors.push(`1인당 최대 ${d.perUserLimit}세트까지 구매할 수 있습니다.`);
  else if (rawQty > c.remaining) errors.push(`잔여 수량(${c.remaining}세트)을 초과했습니다.`);

  const q = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 1;
  const lines: QuoteLine[] = [];
  const skuNeed = new Map<string, { need: number; available: number; label: string }>();
  let skuAdjPerSet = 0;
  let optionalPerSet = 0;
  let addonPerSet = 0;
  let quoteRequired = false;

  for (const item of d.items) {
    const s = sel?.items?.[item.id];
    const included = item.isRequired || !!s?.included;
    if (!included) continue;

    const sku = item.skus.find((x) => x.id === s?.skuId);
    const model = sku ? item.models.find((m) => m.id === sku.modelId) : undefined;
    if (!sku || !model) {
      errors.push(`${item.label}: 모델과 옵션을 선택해주세요.`);
      continue;
    }

    const need = item.quantity * q;
    const prev = skuNeed.get(sku.id);
    skuNeed.set(sku.id, { need: (prev?.need ?? 0) + need, available: sku.available, label: item.label });

    const addons: QuoteLine["addons"] = [];
    let addonUnit = 0;
    for (const g of groupsFor(item, sku)) {
      const picked = [...new Set(s?.addons?.[g.id] ?? [])];
      const values = picked.map((id) => g.values.find((v) => v.id === id));
      if (values.some((v) => !v)) {
        errors.push(`${item.label}: 선택할 수 없는 옵션이 포함되어 있습니다.`);
        continue;
      }
      if (g.selectType === "single" && values.length > 1) {
        errors.push(`${item.label}: ${g.name}은(는) 하나만 선택할 수 있습니다.`);
      }
      if (g.isRequired && values.length === 0) {
        errors.push(`${item.label}: ${g.name}을(를) 선택해주세요.`);
      }
      for (const v of values as DetailAddonValue[]) {
        addons.push({ group: g.name, label: v.label, price: v.price });
        addonUnit += v.price;
        if (v.isQuoteRequired) quoteRequired = true;
      }
    }

    const itemPrice = item.isRequired ? 0 : item.optionalPrice;
    lines.push({
      packageItemId: item.id,
      skuId: sku.id,
      isOptional: !item.isRequired,
      itemLabel: item.label,
      productName: sku.productName ?? item.productName,
      modelCode: model.code,
      modelName: model.name,
      skuCode: sku.sku,
      attributes: sku.attributes,
      addons,
      quantity: need,
      itemPrice,
      skuAdjustment: sku.adjustment,
      addonTotal: addonUnit,
    });

    if (item.isRequired) skuAdjPerSet += sku.adjustment * item.quantity;
    else optionalPerSet += (itemPrice + sku.adjustment) * item.quantity;
    addonPerSet += addonUnit * item.quantity;
  }

  for (const [, v] of skuNeed) {
    if (v.available < v.need) errors.push(`${v.label}: 선택한 옵션의 재고가 부족합니다.`);
  }

  const basePrice = c.campaignPrice * q;
  const optionTotal = skuAdjPerSet * q;
  const optionalItemTotal = optionalPerSet * q;
  const installationFee = addonPerSet * q;
  const shippingFee = 0;
  const discountTotal = 0;

  return {
    ok: errors.length === 0,
    errors,
    quote: {
      quantity: q,
      basePrice,
      optionTotal,
      optionalItemTotal,
      installationFee,
      shippingFee,
      discountTotal,
      grandTotal: basePrice + optionTotal + optionalItemTotal + installationFee + shippingFee - discountTotal,
      listTotal: c.listPrice * q,
      quoteRequired,
      lines,
    },
  };
}

// ---------- URL 전달용 인코딩 ----------
type Compact = { q: number; i: Record<string, [0 | 1, string | null, Record<string, string[]>]> };

export function encodeSelection(sel: Selection): string {
  const compact: Compact = {
    q: sel.quantity,
    i: Object.fromEntries(Object.entries(sel.items).map(([k, v]) => [k, [v.included ? 1 : 0, v.skuId, v.addons]])),
  };
  return btoa(JSON.stringify(compact)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSelection(s: string): Selection | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const c = JSON.parse(atob(b64 + "===".slice((b64.length + 3) % 4))) as Compact;
    return {
      quantity: Number(c.q),
      items: Object.fromEntries(
        Object.entries(c.i ?? {}).map(([k, [inc, sku, addons]]) => [
          k,
          { included: inc === 1, skuId: sku ?? null, addons: addons ?? {} },
        ])
      ),
    };
  } catch {
    return null;
  }
}