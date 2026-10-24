import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won, discountRate } from "@/lib/format";
import { STORE_CATEGORIES, STORE_CATEGORY_LABEL } from "@/lib/store";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import {
  updateProductAll, saveSkuTable, createModel, setModelStatus, createSku,
  createAddonGroup, createAddonValue, updateAddonValue,
} from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

type Price = { list_price: number; sale_price: number; is_active: boolean };
type Sku = { id: string; sku: string; attributes: Record<string, string>; stock: number; status: string; sort_order: number; store_prices: Price | Price[] | null };
type Model = { id: string; model_code: string; model_name: string; image_url: string | null; status: string; sort_order: number; product_skus: Sku[] };
type AddonValue = { id: string; label: string; price: number; is_default: boolean; is_quote_required: boolean; is_active: boolean; sort_order: number };
type AddonGroup = { id: string; name: string; select_type: string; is_required: boolean; sort_order: number; addon_values: AddonValue[] };
type Product = {
  id: string; name: string; product_type: string; status: string; description: string | null; attribute_keys: string[];
  store_visible: boolean; store_category: string | null; bundle_eligible: boolean; store_thumbnail: string | null; store_summary: string | null;
  brand: { name: string } | null; product_models: Model[]; addon_groups: AddonGroup[];
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const TABS = [
  { key: "sales", label: "판매·재고" },
  { key: "basic", label: "기본 정보" },
  { key: "options", label: "설치 옵션" },
];

export default function AdminProductDetail(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
      <ProductDetail {...props} />
    </Suspense>
  );
}

async function ProductDetail({ params, searchParams }: Props) {
  await connection();
  await requireStaff("products");
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "sales";

  const sb = createAdminClient();
  const { data } = await sb
    .from("products")
    .select("*, brand:brands(name), product_models(*, product_skus(*, store_prices(list_price, sale_price, is_active))), addon_groups(*, addon_values(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as unknown as Product;

  const models = [...p.product_models].sort((a, b) => a.sort_order - b.sort_order);
  const skuIds = models.flatMap((m) => m.product_skus.map((s) => s.id));
  const { data: avail } = skuIds.length
    ? await sb.from("sku_availability").select("sku_id, reserved").in("sku_id", skuIds)
    : { data: [] as { sku_id: string; reserved: number }[] };
  const reserved = new Map((avail ?? []).map((a) => [a.sku_id, a.reserved]));
  const optionCount = p.addon_groups.reduce((n, g) => n + g.addon_values.filter((v) => v.is_active).length, 0);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div>
        <Link href="/admin/products" className="text-sm text-sub hover:text-ink">← 제품 목록</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{p.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.store_visible ? "bg-navy text-white" : "bg-white text-sub"}`}>
            {p.store_visible ? "쇼핑몰 노출 중" : "쇼핑몰 숨김"}
          </span>
          {p.status !== "active" && <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-xs font-bold text-coral">판매중지</span>}
          {p.store_visible && (
            <Link href={`/store/${p.id}`} target="_blank" className="text-sm text-navy underline">고객 화면 보기</Link>
          )}
        </div>
        <p className="text-sm text-sub">
          {p.brand?.name} · {p.product_type} · {p.store_category ? STORE_CATEGORY_LABEL[p.store_category] : "분류 없음"}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/products/${p.id}?tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${
              tab === t.key ? "border-navy text-navy" : "border-transparent text-sub hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "options" && optionCount > 0 && <span className="ml-1 text-xs font-normal">({optionCount})</span>}
          </Link>
        ))}
      </div>

      {/* ===== 판매·재고 ===== */}
      {tab === "sales" && (
        <>
          <section className="rounded-xl bg-white p-5">
            <ActionForm action={saveSkuTable} className="space-y-4">
              <input type="hidden" name="product_id" value={p.id} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-b border-line text-left text-[13px] text-sub">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">모델 · SKU</th>
                      <th className="py-2 pr-3 text-right font-semibold">예약</th>
                      <th className="py-2 pr-3 font-semibold">재고</th>
                      <th className="py-2 pr-3 font-semibold">판매상태</th>
                      <th className="py-2 pr-3 font-semibold">정상가</th>
                      <th className="py-2 pr-3 font-semibold">판매가</th>
                      <th className="py-2 pr-3 font-semibold">쇼핑몰 판매</th>
                      <th className="py-2 text-right font-semibold">할인율</th>
                    </tr>
                  </thead>
                  <tbody className="tabular divide-y divide-line">
                    {models.flatMap((m) =>
                      [...m.product_skus].sort((a, b) => a.sort_order - b.sort_order).map((s) => {
                        const pr = one(s.store_prices);
                        return (
                          <tr key={s.id} className="align-middle">
                            <td className="py-2.5 pr-3">
                              <input type="hidden" name="sku_id" value={s.id} />
                              <b>{s.sku}</b>
                              <span className="block text-xs text-sub">
                                {m.model_name} ({m.model_code})
                                {Object.keys(s.attributes ?? {}).length > 0 && ` · ${Object.values(s.attributes).join(" · ")}`}
                                {m.status !== "active" && <span className="ml-1 text-coral">판매중지 모델</span>}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-right text-sub">{reserved.get(s.id) ?? 0}</td>
                            <td className="py-2.5 pr-3">
                              <input name={`stock:${s.id}`} type="number" min={0} defaultValue={s.stock} className={`${input} w-20`} />
                            </td>
                            <td className="py-2.5 pr-3">
                              <select name={`status:${s.id}`} defaultValue={s.status} className={`${input} w-24`}>
                                <option value="active">판매중</option>
                                <option value="soldout">품절</option>
                                <option value="inactive">숨김</option>
                              </select>
                            </td>
                            <td className="py-2.5 pr-3">
                              <input name={`list:${s.id}`} type="number" min={0} step={100} defaultValue={pr?.list_price ?? ""} placeholder="판매가와 같게" className={`${input} w-32`} />
                            </td>
                            <td className="py-2.5 pr-3">
                              <input name={`sale:${s.id}`} type="number" min={0} step={100} defaultValue={pr?.sale_price ?? ""} placeholder="미판매" className={`${input} w-32`} />
                            </td>
                            <td className="py-2.5 pr-3">
                              <label className="flex items-center gap-1.5 text-xs">
                                <input name={`sell:${s.id}`} type="checkbox" defaultChecked={pr ? pr.is_active : true} className="h-4 w-4 accent-[#102a43]" />
                                판매
                              </label>
                            </td>
                            <td className="py-2.5 text-right text-xs">
                              {pr && discountRate(pr.list_price, pr.sale_price) > 0 ? (
                                <b className="text-coral">{discountRate(pr.list_price, pr.sale_price)}%</b>
                              ) : (
                                <span className="text-sub">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {skuIds.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-sub">등록된 SKU가 없습니다. 아래에서 모델과 SKU를 추가하세요.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <SubmitButton>전체 저장</SubmitButton>
                <span className="text-xs text-sub">
                  판매가를 비우면 쇼핑몰 미판매 · 재고는 공동구매와 공유 · 예약은 결제 대기 주문이 잡고 있는 수량
                </span>
              </div>
            </ActionForm>
          </section>

          {/* 모델·SKU 추가/관리 */}
          <details className="rounded-xl bg-white">
            <summary className="cursor-pointer list-none p-5 font-bold">
              모델·SKU 추가 / 모델 판매중지 <span className="ml-2 text-sm font-normal text-sub">크기·색상 선택이 있는 제품에서 사용</span>
            </summary>
            <div className="space-y-4 border-t border-line p-5">
              {models.map((m) => (
                <div key={m.id} className="rounded-lg border border-line">
                  <div className="flex flex-wrap items-center gap-3 bg-soft/60 px-4 py-2.5 text-sm">
                    <b>{m.model_name}</b>
                    <span className="text-sub">{m.model_code} · SKU {m.product_skus.length}개</span>
                    <ActionForm action={setModelStatus} className="ml-auto">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="status" value={m.status === "active" ? "inactive" : "active"} />
                      <button className="text-xs font-semibold text-sub underline">{m.status === "active" ? "모델 판매중지" : "모델 판매 재개"}</button>
                    </ActionForm>
                  </div>
                  <ActionForm action={createSku} className="flex flex-wrap items-end gap-2 px-4 py-3">
                    <input type="hidden" name="model_id" value={m.id} />
                    <label className="text-xs font-semibold">
                      SKU 코드
                      <input name="sku" required placeholder={`${m.model_code}-65-BK`} className={`${input} mt-1 block w-48 uppercase`} />
                    </label>
                    {p.attribute_keys.map((k) => (
                      <label key={k} className="text-xs font-semibold">
                        {k}
                        <input name={`attr:${k}`} required className={`${input} mt-1 block w-28`} />
                      </label>
                    ))}
                    <label className="text-xs font-semibold">
                      재고
                      <input name="stock" type="number" min={0} defaultValue={0} className={`${input} mt-1 block w-20`} />
                    </label>
                    <SubmitButton className="h-10">SKU 추가</SubmitButton>
                  </ActionForm>
                </div>
              ))}

              <ActionForm action={createModel} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-4">
                <input type="hidden" name="product_id" value={p.id} />
                <label className="text-[13px] font-semibold">
                  모델 코드
                  <input name="model_code" required className={`${input} mt-1 block w-44 uppercase`} />
                </label>
                <label className="text-[13px] font-semibold">
                  모델명
                  <input name="model_name" required className={`${input} mt-1 block w-56`} />
                </label>
                <label className="text-[13px] font-semibold">
                  이미지 URL (선택)
                  <input name="image_url" placeholder="https://" className={`${input} mt-1 block w-64`} />
                </label>
                <input type="hidden" name="sort_order" value={models.length + 1} />
                <SubmitButton>모델 추가</SubmitButton>
              </ActionForm>
              <p className="text-xs text-sub">새 SKU의 판매가는 추가한 뒤 위 표에서 입력하세요.</p>
            </div>
          </details>
        </>
      )}

      {/* ===== 기본 정보 ===== */}
      {tab === "basic" && (
        <section className="rounded-xl bg-white p-5">
          <ActionForm action={updateProductAll} className="grid gap-4 md:grid-cols-4">
            <input type="hidden" name="id" value={p.id} />
            <label className="text-[13px] font-semibold md:col-span-2">
              제품명
              <input name="name" defaultValue={p.name} required maxLength={100} className={`${input} mt-1 block w-full`} />
            </label>
            <label className="text-[13px] font-semibold">
              제품종류
              <input name="product_type" defaultValue={p.product_type} required className={`${input} mt-1 block w-full`} />
            </label>
            <label className="text-[13px] font-semibold">
              상태
              <select name="status" defaultValue={p.status} className={`${input} mt-1 block w-full`}>
                <option value="active">판매중</option>
                <option value="inactive">판매중지 (공동구매·쇼핑몰 모두)</option>
              </select>
            </label>

            <div className="flex items-center gap-5 text-sm font-semibold md:col-span-4">
              <label className="flex items-center gap-1.5"><input name="store_visible" type="checkbox" defaultChecked={p.store_visible} className="h-4 w-4 accent-[#102a43]" /> 쇼핑몰 노출</label>
              <label className="flex items-center gap-1.5"><input name="bundle_eligible" type="checkbox" defaultChecked={p.bundle_eligible} className="h-4 w-4 accent-[#102a43]" /> 세트 할인 대상</label>
            </div>
            <label className="text-[13px] font-semibold md:col-span-2">
              쇼핑몰 분류
              <select name="store_category" defaultValue={p.store_category ?? ""} className={`${input} mt-1 block w-full`}>
                <option value="">선택 안 함</option>
                {STORE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.desc})</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold md:col-span-2">
              요약 (목록 카드에 표시)
              <input name="store_summary" defaultValue={p.store_summary ?? ""} maxLength={200} className={`${input} mt-1 block w-full`} />
            </label>
            <label className="text-[13px] font-semibold md:col-span-4">
              대표 이미지 URL
              <input name="store_thumbnail" defaultValue={p.store_thumbnail ?? ""} placeholder="https:// 또는 /images/..." className={`${input} mt-1 block w-full`} />
            </label>
            <label className="text-[13px] font-semibold md:col-span-4">
              상세 설명 (고객에게 표시)
              <textarea name="description" defaultValue={p.description ?? ""} maxLength={5000} className={`${input} mt-1 block h-28 w-full py-2`} />
            </label>

            <details className="md:col-span-4">
              <summary className="cursor-pointer text-sm font-semibold text-sub">고급: 선택 항목 (크기·색상 등)</summary>
              <label className="mt-2 block text-[13px] font-semibold">
                선택 항목 (쉼표 구분, 고객이 고르는 순서)
                <input name="attribute_keys" defaultValue={p.attribute_keys.join(", ")} placeholder="화면 크기, 색상" className={`${input} mt-1 block w-full`} />
              </label>
              {skuIds.length > 0 && p.attribute_keys.length > 0 && (
                <p className="mt-1 text-xs text-coral">SKU가 있는 상태에서 이름을 바꾸면 기존 SKU 값과 맞지 않게 됩니다.</p>
              )}
            </details>

            <div className="md:col-span-4"><SubmitButton>저장</SubmitButton></div>
          </ActionForm>
        </section>
      )}

      {/* ===== 설치 옵션 ===== */}
      {tab === "options" && (
        <section className="rounded-xl bg-white p-5">
          <p className="mb-4 text-xs text-sub">설치 방식, 벽걸이, 배관, 설치 키트처럼 추가금이 붙는 선택입니다. 공동구매와 쇼핑몰에 모두 적용됩니다.</p>
          <div className="space-y-4">
            {[...p.addon_groups].sort((a, b) => a.sort_order - b.sort_order).map((g) => (
              <div key={g.id} className="rounded-lg border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-soft/60 px-4 py-3">
                  <b>{g.name}</b>
                  <span className="text-xs text-sub">{g.select_type === "single" ? "단일 선택" : "복수 선택"} · {g.is_required ? "필수" : "선택"}</span>
                </div>
                <div className="divide-y divide-line">
                  {[...g.addon_values].sort((a, b) => a.sort_order - b.sort_order).map((v) => (
                    <ActionForm key={v.id} action={updateAddonValue} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                      <input type="hidden" name="id" value={v.id} />
                      <span className={`min-w-40 flex-1 font-semibold ${v.is_active ? "" : "text-sub line-through"}`}>
                        {v.label}
                        {v.is_default && <span className="ml-1 text-xs font-normal text-navy">기본</span>}
                        {v.is_quote_required && <span className="ml-1 text-xs font-normal text-sub">현장 견적</span>}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-sub">
                        추가금
                        <input name="price" type="number" min={0} step={1000} defaultValue={v.price} className={`${input} tabular w-28`} />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input name="is_active" type="checkbox" defaultChecked={v.is_active} className="h-4 w-4 accent-[#102a43]" /> 노출
                      </label>
                      <SubmitButton className="h-9">저장</SubmitButton>
                    </ActionForm>
                  ))}
                </div>
                <ActionForm action={createAddonValue} className="flex flex-wrap items-end gap-2 border-t border-dashed border-line bg-soft/30 px-4 py-3">
                  <input type="hidden" name="group_id" value={g.id} />
                  <label className="text-xs font-semibold">
                    옵션명
                    <input name="label" required className={`${input} mt-1 block w-40`} />
                  </label>
                  <label className="text-xs font-semibold">
                    추가금
                    <input name="price" type="number" min={0} step={1000} defaultValue={0} className={`${input} mt-1 block w-28`} />
                  </label>
                  <label className="flex items-center gap-1.5 pb-2.5 text-xs"><input name="is_default" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 기본 선택</label>
                  <label className="flex items-center gap-1.5 pb-2.5 text-xs"><input name="is_quote_required" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 현장 견적</label>
                  <SubmitButton className="h-10">옵션 추가</SubmitButton>
                </ActionForm>
              </div>
            ))}
            {p.addon_groups.length === 0 && <p className="rounded-lg bg-soft p-6 text-center text-sm text-sub">설치 옵션이 없습니다.</p>}
          </div>

          <ActionForm action={createAddonGroup} className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-4">
            <input type="hidden" name="product_id" value={p.id} />
            <label className="text-[13px] font-semibold">
              옵션 그룹명
              <input name="name" required placeholder="설치 방식" className={`${input} mt-1 block w-44`} />
            </label>
            <label className="text-[13px] font-semibold">
              선택 방식
              <select name="select_type" className={`${input} mt-1 block w-32`}>
                <option value="single">단일 선택</option>
                <option value="multi">복수 선택</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-2.5 text-[13px] font-semibold"><input name="is_required" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 필수</label>
            <SubmitButton>그룹 추가</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-xs text-sub">현장 견적 옵션은 0원으로 두면 결제 금액에 포함되지 않고, 고객에게 “현장에서 추가 비용이 발생할 수 있음”으로 안내됩니다.</p>
        </section>
      )}

      <p className="text-xs text-sub">판매가 참고: {won(0)} 옵션은 무료로 표시됩니다.</p>
    </div>
  );
}