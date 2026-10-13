"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Check } from "lucide-react";
import ItemSelector from "@/components/purchase/ItemSelector";
import { won, discountRate } from "@/lib/format";
import { addToCart, MAX_QTY } from "@/lib/cart";
import { describeRule, STORE_CATEGORY_LABEL, type DiscountRule } from "@/lib/store";
import type { DetailItem, ItemSelection } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/queries/store";

export default function StorePurchasePanel({ p, rules }: { p: StoreProduct; rules: DiscountRule[] }) {
  const router = useRouter();

  // 공동구매용 선택 화면 재사용: 추가금 = 최저가 대비 차액
  const item: DetailItem = useMemo(() => {
    const defaultSku = [...p.skus].filter((s) => s.available > 0).sort((a, b) => a.salePrice - b.salePrice)[0] ?? p.skus[0];
    return {
      id: p.id,
      label: p.productType,
      isRequired: true,
      optionalPrice: 0,
      quantity: 1,
      productName: p.name,
      productType: p.productType,
      attributeKeys: p.attributeKeys,
      models: p.models,
      skus: p.skus.map((s) => ({
        id: s.id, sku: s.sku, modelId: s.modelId, attributes: s.attributes, imageUrl: s.imageUrl,
        adjustment: s.salePrice - p.minPrice, isDefault: s.id === defaultSku.id, available: s.available,
      })),
      addonGroups: p.addonGroups,
    };
  }, [p]);

  const [sel, setSel] = useState<ItemSelection>(() => {
    const addons: Record<string, string[]> = {};
    for (const g of p.addonGroups) {
      const d = g.values.filter((v) => v.isDefault).map((v) => v.id);
      addons[g.id] = g.selectType === "single" ? (d[0] ? [d[0]] : g.isRequired && g.values[0] ? [g.values[0].id] : []) : d;
    }
    return { included: true, skuId: item.skus.find((s) => s.isDefault)?.id ?? null, addons };
  });
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const sku = p.skus.find((s) => s.id === sel.skuId);
  const addonTotal = p.addonGroups.reduce(
    (sum, g) => sum + (sel.addons[g.id] ?? []).reduce((s, id) => s + (g.values.find((v) => v.id === id)?.price ?? 0), 0),
    0
  );
  const maxQty = Math.max(Math.min(sku?.available ?? 0, MAX_QTY), 0);
  const unit = (sku?.salePrice ?? 0) + addonTotal;

  const validate = () => {
    if (!sku) return "옵션을 선택해주세요.";
    if (sku.available < qty) return "선택한 옵션의 재고가 부족합니다.";
    for (const g of p.addonGroups) {
      if (g.isRequired && !(sel.addons[g.id] ?? []).length) return `${g.name}을(를) 선택해주세요.`;
    }
    return "";
  };

  const put = (goCart: boolean) => {
    const e = validate();
    setError(e);
    if (e || !sku) return;
    addToCart({ productId: p.id, skuId: sku.id, addons: sel.addons, quantity: qty });
    if (goCart) router.push("/cart");
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold" style={{ color: p.brand.theme_color ?? "#102a43" }}>{p.brand.name}</p>
        <p className="mt-1 text-[13px] text-sub">{STORE_CATEGORY_LABEL[p.category]} · {p.productType}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight md:text-[28px]">{p.name}</h1>
        {p.summary && <p className="mt-2 text-[15px] text-ink/80">{p.summary}</p>}

        {sku && (
          <div className="mt-5">
            {sku.listPrice > sku.salePrice && (
              <p className="tabular text-sm text-sub">정상가 <span className="line-through">{won(sku.listPrice)}</span></p>
            )}
            <p className="tabular flex items-baseline gap-2">
              {discountRate(sku.listPrice, sku.salePrice) > 0 && (
                <span className="text-[28px] font-extrabold text-coral">{discountRate(sku.listPrice, sku.salePrice)}%</span>
              )}
              <span className="text-[28px] font-extrabold">{won(sku.salePrice)}</span>
            </p>
          </div>
        )}
      </div>

      {p.bundleEligible && rules.length > 0 && (
        <div className="rounded-xl bg-soft p-4 text-sm">
          <p className="font-bold text-navy">세트 할인 대상 상품</p>
          <ul className="mt-1 space-y-0.5 text-sub">
            {rules.map((r) => <li key={r.id}>{r.name}: {describeRule(r)}</li>)}
          </ul>
          <p className="mt-1 text-xs text-sub">장바구니에서 다른 할인 대상 상품과 함께 주문하면 자동 적용됩니다.</p>
        </div>
      )}

      <ItemSelector item={item} value={sel} need={qty} onChange={setSel} plain />

      <div className="flex items-center justify-between rounded-xl border border-line p-5">
        <div>
          <p className="font-bold">수량</p>
          <p className="text-xs text-sub">{sku ? `구매 가능 ${maxQty}개` : "옵션을 선택해주세요"}</p>
        </div>
        <div className="flex items-center rounded-lg border border-line">
          <button type="button" aria-label="수량 감소" onClick={() => setQty((q) => Math.max(q - 1, 1))} disabled={qty <= 1} className="grid h-11 w-11 place-items-center disabled:opacity-30">
            <Minus size={16} />
          </button>
          <span className="tabular w-10 text-center font-bold">{qty}</span>
          <button type="button" aria-label="수량 증가" onClick={() => setQty((q) => Math.min(q + 1, maxQty))} disabled={qty >= maxQty} className="grid h-11 w-11 place-items-center disabled:opacity-30">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line p-5">
        <dl className="tabular space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-sub">상품 금액</dt><dd>{won((sku?.salePrice ?? 0) * qty)}</dd></div>
          <div className="flex justify-between"><dt className="text-sub">설치·부가 옵션</dt><dd>{addonTotal > 0 ? won(addonTotal * qty) : "0원"}</dd></div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-bold">합계</span>
          <span className="tabular text-2xl font-extrabold text-navy">{won(unit * qty)}</span>
        </div>
        <p className="mt-2 text-xs text-sub">세트 할인은 장바구니에서 함께 담은 상품 기준으로 계산됩니다.</p>
      </div>

      {error && <p className="rounded-lg bg-coral/10 p-3 text-sm font-semibold text-coral" role="alert">{error}</p>}
      {added && (
        <p className="flex items-center justify-between rounded-lg bg-navy/5 p-3 text-sm font-semibold text-navy" role="status">
          <span className="flex items-center gap-1.5"><Check size={16} /> 장바구니에 담았습니다.</span>
          <Link href="/cart" className="underline">장바구니 보기</Link>
        </p>
      )}

      <div className="hidden gap-2 lg:flex">
        <button type="button" onClick={() => put(false)} disabled={!p.inStock} className="h-14 flex-1 rounded-xl border border-navy font-bold text-navy hover:bg-navy/5 disabled:opacity-40">
          장바구니 담기
        </button>
        <button type="button" onClick={() => put(true)} disabled={!p.inStock} className="h-14 flex-1 rounded-xl bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
          {p.inStock ? "바로 구매" : "품절"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex gap-2">
          <button type="button" onClick={() => put(false)} disabled={!p.inStock} className="h-12 flex-1 rounded-xl border border-navy font-bold text-navy disabled:opacity-40">
            장바구니
          </button>
          <button type="button" onClick={() => put(true)} disabled={!p.inStock} className="h-12 flex-1 rounded-xl bg-navy font-bold text-white disabled:bg-sub">
            {p.inStock ? `바로 구매 ${won(unit * qty)}` : "품절"}
          </button>
        </div>
      </div>
    </div>
  );
}