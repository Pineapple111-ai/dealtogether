import type { StoreProduct } from "@/lib/queries/store";
import type { DiscountRule } from "@/lib/store";

export type CartInput = {
  id: string;
  productId: string;
  skuId: string;
  addons: Record<string, string[]>;
  quantity: number;
};

export type StoreQuoteLine = {
  cartId: string;
  productId: string;
  skuId: string;
  productName: string;
  productType: string;
  brand: string;
  category: string;
  thumbnail: string | null;
  modelName: string;
  modelCode: string;
  skuCode: string;
  attributes: Record<string, string>;
  addons: { group: string; label: string; price: number }[];
  quantity: number;
  unitPrice: number;
  listPrice: number;
  addonUnit: number;
  lineTotal: number;
  bundleEligible: boolean;
  quoteRequired: boolean;
  error?: string;
};

export type StoreQuote = {
  ok: boolean;
  lines: StoreQuoteLine[];
  goodsTotal: number;
  addonTotal: number;
  eligibleAmount: number;
  eligibleCount: number;
  eligibleCategories: number;
  appliedRules: { name: string; rate: number }[];
  rawRate: number;
  rate: number;
  maxRate: number;
  discount: number;
  shippingFee: number;
  grandTotal: number;
  quoteRequired: boolean;
  hints: string[];
};

const MAX_QTY = 10;

/** 장바구니 → 견적 (서버 전용: 최신 상품·가격·재고·할인 규칙 기준) */
export function computeStoreQuote(
  products: StoreProduct[],
  cart: CartInput[],
  rules: DiscountRule[],
  maxRate: number
): StoreQuote {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: StoreQuoteLine[] = [];
  const skuNeed = new Map<string, number>();

  for (const c of cart) {
    const p = byId.get(c.productId);
    const sku = p?.skus.find((s) => s.id === c.skuId);
    const model = sku ? p?.models.find((m) => m.id === sku.modelId) : undefined;
    const qty = Number.isInteger(c.quantity) ? Math.min(Math.max(c.quantity, 1), MAX_QTY) : 1;

    const base: StoreQuoteLine = {
      cartId: c.id,
      productId: c.productId,
      skuId: c.skuId,
      productName: p?.name ?? "판매 종료된 상품",
      productType: p?.productType ?? "",
      brand: p?.brand.name ?? "",
      category: p?.category ?? "",
      thumbnail: p?.thumbnail ?? null,
      modelName: model?.name ?? "",
      modelCode: model?.code ?? "",
      skuCode: sku?.sku ?? "",
      attributes: sku?.attributes ?? {},
      addons: [],
      quantity: qty,
      unitPrice: sku?.salePrice ?? 0,
      listPrice: sku?.listPrice ?? 0,
      addonUnit: 0,
      lineTotal: 0,
      bundleEligible: p?.bundleEligible ?? false,
      quoteRequired: false,
    };

    if (!p) { lines.push({ ...base, error: "판매가 종료된 상품입니다." }); continue; }
    if (!sku || !model) { lines.push({ ...base, error: "선택한 옵션이 더 이상 판매되지 않습니다. 다시 담아주세요." }); continue; }

    // 부가 옵션 검증
    let addonError = "";
    for (const g of p.addonGroups) {
      const picked = [...new Set(c.addons?.[g.id] ?? [])];
      const values = picked.map((id) => g.values.find((v) => v.id === id));
      if (values.some((v) => !v)) { addonError = "선택한 옵션이 변경되었습니다. 다시 담아주세요."; break; }
      if (g.selectType === "single" && values.length > 1) { addonError = `${g.name}은(는) 하나만 선택할 수 있습니다.`; break; }
      if (g.isRequired && values.length === 0) { addonError = `${g.name}을(를) 선택해야 합니다. 다시 담아주세요.`; break; }
      for (const v of values) {
        base.addons.push({ group: g.name, label: v!.label, price: v!.price });
        base.addonUnit += v!.price;
        if (v!.isQuoteRequired) base.quoteRequired = true;
      }
    }
    if (addonError) { lines.push({ ...base, error: addonError }); continue; }

    skuNeed.set(sku.id, (skuNeed.get(sku.id) ?? 0) + qty);
    base.lineTotal = (base.unitPrice + base.addonUnit) * qty;
    lines.push(base);
  }

  // 같은 SKU를 여러 줄에 담은 경우까지 합산해 재고 확인
  for (const l of lines) {
    if (l.error) continue;
    const sku = byId.get(l.productId)!.skus.find((s) => s.id === l.skuId)!;
    if (sku.available <= 0) l.error = "품절되었습니다.";
    else if ((skuNeed.get(l.skuId) ?? 0) > sku.available) l.error = `재고가 부족합니다. (구매 가능 ${sku.available}개)`;
  }

  const valid = lines.filter((l) => !l.error);
  const goodsTotal = valid.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const addonTotal = valid.reduce((s, l) => s + l.addonUnit * l.quantity, 0);

  // 세트 할인 (할인 대상 상품 기준)
  const eligible = valid.filter((l) => l.bundleEligible);
  const eligibleAmount = eligible.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const eligibleCount = new Set(eligible.map((l) => l.productId)).size;
  const eligibleCategories = new Set(eligible.map((l) => l.category)).size;
  const metric = { count: eligibleCount, category: eligibleCategories, amount: eligibleAmount };

  const appliedRules: { name: string; rate: number }[] = [];
  const hints: string[] = [];
  for (const r of rules) {
    const tiers = [...r.tiers].sort((a, b) => a.min - b.min);
    const v = metric[r.rule_type];
    const hit = [...tiers].reverse().find((t) => v >= t.min);
    if (hit) appliedRules.push({ name: r.name, rate: hit.rate });
    const next = tiers.find((t) => v < t.min);
    if (next) {
      const gap = next.min - v;
      hints.push(
        r.rule_type === "count"
          ? `할인 대상 상품 ${gap}개 품목을 더 담으면 ${r.name} ${next.rate}%`
          : r.rule_type === "category"
            ? `다른 분류 상품을 ${gap}개 더 담으면 ${r.name} ${next.rate}%`
            : `할인 대상 상품 ${gap.toLocaleString("ko-KR")}원 더 담으면 ${r.name} ${next.rate}%`
      );
    }
  }
  const rawRate = Math.round(appliedRules.reduce((s, a) => s + a.rate, 0) * 100) / 100;
  const rate = Math.min(rawRate, maxRate);
  const discount = Math.floor((eligibleAmount * rate) / 100 / 10) * 10; // 10원 단위 절사

  const shippingFee = 0;
  return {
    ok: lines.length > 0 && lines.every((l) => !l.error),
    lines,
    goodsTotal,
    addonTotal,
    eligibleAmount,
    eligibleCount,
    eligibleCategories,
    appliedRules,
    rawRate,
    rate,
    maxRate,
    discount,
    shippingFee,
    grandTotal: goodsTotal + addonTotal + shippingFee - discount,
    quoteRequired: valid.some((l) => l.quoteRequired),
    hints: hints.slice(0, 2),
  };
}