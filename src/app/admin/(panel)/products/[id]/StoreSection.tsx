import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_CATEGORIES } from "@/lib/store";
import { won, discountRate } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { updateStoreSettings, saveStorePrices } from "../actions";

type Sku = { id: string; sku: string; attributes: Record<string, string>; stock: number; status: string };
type Model = { id: string; model_name: string; model_code: string; status: string; product_skus: Sku[] };

type Props = {
  product: {
    id: string;
    store_visible: boolean;
    store_category: string | null;
    bundle_eligible: boolean;
    store_thumbnail: string | null;
    store_summary: string | null;
  };
  models: Model[];
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default async function StoreSection({ product: p, models }: Props) {
  const skuIds = models.flatMap((m) => m.product_skus.map((s) => s.id));
  const { data } = skuIds.length
    ? await createAdminClient().from("store_prices").select("*").in("sku_id", skuIds)
    : { data: [] };
  const prices = new Map(
    ((data ?? []) as { sku_id: string; list_price: number; sale_price: number; is_active: boolean }[]).map((r) => [r.sku_id, r])
  );
  const pricedCount = [...prices.values()].filter((r) => r.is_active).length;

  return (
    <section className={`rounded-xl bg-white p-5 ${p.store_visible ? "ring-2 ring-navy/20" : ""}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-bold">일반 쇼핑몰 판매</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.store_visible ? "bg-navy text-white" : "bg-soft text-sub"}`}>
          {p.store_visible ? "쇼핑몰 노출 중" : "미노출"}
        </span>
        <span className="text-xs text-sub">판매가 등록 SKU {pricedCount}개</span>
      </div>

      <ActionForm action={updateStoreSettings} className="grid gap-3 md:grid-cols-4">
        <input type="hidden" name="id" value={p.id} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="store_visible" type="checkbox" defaultChecked={p.store_visible} className="h-4 w-4 accent-[#102a43]" />
          쇼핑몰 노출
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="bundle_eligible" type="checkbox" defaultChecked={p.bundle_eligible} className="h-4 w-4 accent-[#102a43]" />
          세트 할인 대상
        </label>
        <label className="text-[13px] font-semibold md:col-span-2">
          분류
          <select name="store_category" defaultValue={p.store_category ?? ""} className={`${input} mt-1 block w-full`}>
            <option value="">선택</option>
            {STORE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label} ({c.desc})</option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-semibold md:col-span-2">
          대표 이미지 URL
          <input name="store_thumbnail" defaultValue={p.store_thumbnail ?? ""} placeholder="https://" className={`${input} mt-1 block w-full`} />
        </label>
        <label className="text-[13px] font-semibold md:col-span-2">
          요약 (목록 카드에 표시)
          <input name="store_summary" defaultValue={p.store_summary ?? ""} maxLength={200} className={`${input} mt-1 block w-full`} />
        </label>
        <div className="md:col-span-4"><SubmitButton>쇼핑몰 설정 저장</SubmitButton></div>
      </ActionForm>

      <ActionForm action={saveStorePrices} className="mt-6 space-y-3">
        <input type="hidden" name="product_id" value={p.id} />
        <p className="text-xs text-sub">
          판매가를 비우면 해당 SKU는 쇼핑몰에서 판매하지 않습니다. 정상가를 비우면 판매가와 같게 저장됩니다. 재고는 위의 SKU 재고를 공동구매와 함께 사용합니다.
        </p>
        {models.map((m) => (
          <div key={m.id} className="rounded-lg border border-line">
            <p className="border-b border-line bg-soft/60 px-3 py-2 text-sm font-semibold">
              {m.model_name} <span className="font-normal text-sub">{m.model_code}</span>
              {m.status !== "active" && <span className="ml-2 text-xs text-coral">판매중지 모델</span>}
            </p>
            {m.product_skus.length === 0 && <p className="px-3 py-2 text-xs text-sub">SKU가 없습니다.</p>}
            {m.product_skus.map((s) => {
              const pr = prices.get(s.id);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-sm first:border-t-0">
                  <input type="hidden" name="sku_id" value={s.id} />
                  <span className="min-w-56 flex-1">
                    <b>{s.sku}</b>
                    <span className="ml-2 text-sub">{Object.values(s.attributes).join(" · ")}</span>
                    <span className="tabular ml-2 text-xs text-sub">재고 {s.stock}</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-sub">
                    정상가
                    <input name={`list:${s.id}`} type="number" min={0} step={1000} defaultValue={pr?.list_price ?? ""} className={`${input} tabular h-9 w-32`} />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-sub">
                    판매가
                    <input name={`sale:${s.id}`} type="number" min={0} step={1000} defaultValue={pr?.sale_price ?? ""} className={`${input} tabular h-9 w-32`} />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input name={`active:${s.id}`} type="checkbox" defaultChecked={pr ? pr.is_active : true} className="h-4 w-4 accent-[#102a43]" />
                    판매
                  </label>
                  {pr && (
                    <span className="tabular w-32 text-right text-xs text-sub">
                      {won(pr.sale_price)}
                      {discountRate(pr.list_price, pr.sale_price) > 0 && (
                        <b className="ml-1 text-coral">{discountRate(pr.list_price, pr.sale_price)}%</b>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <SubmitButton>판매가 저장</SubmitButton>
      </ActionForm>
    </section>
  );
}