import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import {
  updateProduct, createModel, setModelStatus, createSku, updateSku,
  createAddonGroup, createAddonValue, updateAddonValue,
} from "../actions";
import StoreSection from "./StoreSection";

type Params = { params: Promise<{ id: string }> };

type Sku = { id: string; sku: string; attributes: Record<string, string>; stock: number; status: string; sort_order: number };
type Model = { id: string; model_code: string; model_name: string; image_url: string | null; status: string; sort_order: number; product_skus: Sku[] };
type AddonValue = { id: string; label: string; price: number; is_default: boolean; is_quote_required: boolean; is_active: boolean; sort_order: number };
type AddonGroup = { id: string; name: string; select_type: string; is_required: boolean; sort_order: number; addon_values: AddonValue[] };
type Product = {
  id: string; name: string; product_type: string; status: string; description: string | null;
  attribute_keys: string[]; brand: { name: string };
  product_models: Model[]; addon_groups: AddonGroup[];
  store_visible: boolean; store_category: string | null; bundle_eligible: boolean;
  store_thumbnail: string | null; store_summary: string | null;
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminProductDetail({ params }: Params) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: Params) {
  await connection();
  await requireStaff("products");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const sb = createAdminClient();
  const { data } = await sb
    .from("products")
    .select("*, brand:brands(name), product_models(*, product_skus(*)), addon_groups(*, addon_values(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as unknown as Product;

  const skuIds = p.product_models.flatMap((m) => m.product_skus.map((s) => s.id));
  const { data: avail } = skuIds.length
    ? await sb.from("sku_availability").select("sku_id, reserved").in("sku_id", skuIds)
    : { data: [] as { sku_id: string; reserved: number }[] };
  const reserved = new Map((avail ?? []).map((a) => [a.sku_id, a.reserved]));

  const models = [...p.product_models].sort((a, b) => a.sort_order - b.sort_order);
  const groups = [...p.addon_groups].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/products" className="text-sm text-sub hover:text-ink">← 제품 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold">{p.name}</h1>
        <p className="text-sm text-sub">{p.brand?.name} · {p.product_type}</p>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">기본 정보</h2>
        <ActionForm action={updateProduct} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="text-[13px] font-semibold">
            제품 종류
            <input name="product_type" defaultValue={p.product_type} className={`${input} mt-1 block w-36`} required />
          </label>
          <label className="text-[13px] font-semibold">
            제품명
            <input name="name" defaultValue={p.name} className={`${input} mt-1 block w-64`} required />
          </label>
          <label className="text-[13px] font-semibold">
            선택 항목 (쉼표 구분)
            <input name="attribute_keys" defaultValue={p.attribute_keys.join(", ")} className={`${input} mt-1 block w-56`} />
          </label>
          <label className="text-[13px] font-semibold">
            상태
            <select name="status" defaultValue={p.status} className={`${input} mt-1 block w-28`}>
              <option value="active">판매중</option>
              <option value="inactive">판매중지</option>
            </select>
          </label>
          <label className="basis-full text-[13px] font-semibold">
            설명
            <textarea name="description" defaultValue={p.description ?? ""} className={`${input} mt-1 block h-20 w-full py-2`} maxLength={2000} />
          </label>
          <SubmitButton>저장</SubmitButton>
        </ActionForm>
        {models.some((m) => m.product_skus.length > 0) && (
          <p className="mt-3 text-xs text-coral">SKU가 등록된 상태에서 선택 항목 이름을 바꾸면 기존 SKU의 값과 맞지 않게 됩니다. 신중히 변경하세요.</p>
        )}
      </section>

      {/* 모델 + SKU */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-1 font-bold">모델 · SKU</h2>
        <p className="mb-4 text-xs text-sub">SKU는 실제 판매 조합(예: 65인치·블랙)이며 재고 단위입니다. 고객 화면에는 등록된 조합만 선택지로 나타납니다.</p>

        <div className="space-y-5">
          {models.map((m) => (
            <div key={m.id} className="rounded-lg border border-line">
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-soft/60 px-4 py-3">
                <b>{m.model_name}</b>
                <span className="text-sm text-sub">{m.model_code}</span>
                <span className={`text-xs font-bold ${m.status === "active" ? "text-navy" : "text-sub"}`}>
                  {m.status === "active" ? "판매중" : "판매중지"}
                </span>
                <ActionForm action={setModelStatus} className="ml-auto">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="status" value={m.status === "active" ? "inactive" : "active"} />
                  <button className="text-xs font-semibold text-sub underline">{m.status === "active" ? "판매중지" : "판매 재개"}</button>
                </ActionForm>
              </div>

              <div className="divide-y divide-line">
                {[...m.product_skus].sort((a, b) => a.sort_order - b.sort_order).map((s) => (
                  <ActionForm key={s.id} action={updateSku} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <input type="hidden" name="id" value={s.id} />
                    <span className="w-48 font-semibold">{s.sku}</span>
                    <span className="min-w-40 flex-1 text-sub">
                      {Object.entries(s.attributes).map(([k, v]) => `${k} ${v}`).join(" · ")}
                    </span>
                    <span className="tabular text-xs text-sub">예약 {reserved.get(s.id) ?? 0}</span>
                    <label className="flex items-center gap-1.5 text-xs text-sub">
                      재고
                      <input name="stock" type="number" min={0} defaultValue={s.stock} className={`${input} tabular w-20`} />
                    </label>
                    <select name="status" defaultValue={s.status} className={`${input} w-24`}>
                      <option value="active">판매중</option>
                      <option value="soldout">품절</option>
                      <option value="inactive">숨김</option>
                    </select>
                    <SubmitButton className="h-9">저장</SubmitButton>
                  </ActionForm>
                ))}
              </div>

              {/* SKU 추가 */}
              <ActionForm action={createSku} className="flex flex-wrap items-end gap-2 border-t border-dashed border-line bg-soft/30 px-4 py-3">
                <input type="hidden" name="model_id" value={m.id} />
                <label className="text-xs font-semibold">
                  SKU 코드
                  <input name="sku" className={`${input} mt-1 block w-48 uppercase`} required placeholder={`${m.model_code}-65-BK`} />
                </label>
                {p.attribute_keys.map((k) => (
                  <label key={k} className="text-xs font-semibold">
                    {k}
                    <input name={`attr:${k}`} className={`${input} mt-1 block w-28`} required />
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
        </div>

        {/* 모델 추가 */}
        <ActionForm action={createModel} className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-4">
          <input type="hidden" name="product_id" value={p.id} />
          <label className="text-[13px] font-semibold">
            모델 코드
            <input name="model_code" className={`${input} mt-1 block w-44 uppercase`} required placeholder="실제 모델 코드" />
          </label>
          <label className="text-[13px] font-semibold">
            모델명
            <input name="model_name" className={`${input} mt-1 block w-56`} required />
          </label>
          <label className="text-[13px] font-semibold">
            이미지 URL (선택)
            <input name="image_url" className={`${input} mt-1 block w-64`} placeholder="https://" />
          </label>
          <label className="text-[13px] font-semibold">
            순서
            <input name="sort_order" type="number" defaultValue={models.length + 1} className={`${input} mt-1 block w-16`} />
          </label>
          <SubmitButton>모델 추가</SubmitButton>
        </ActionForm>
      </section>

      <StoreSection product={p} models={models} />

      {/* 부가 옵션 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-1 font-bold">부가 옵션</h2>
        <p className="mb-4 text-xs text-sub">설치 방식, 벽걸이 종류, 배관, 설치 키트처럼 SKU와 별개로 추가금이 붙는 선택입니다.</p>

        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-line">
              <div className="flex items-center gap-2 border-b border-line bg-soft/60 px-4 py-3">
                <b>{g.name}</b>
                <span className="text-xs text-sub">
                  {g.select_type === "single" ? "단일 선택" : "복수 선택"} · {g.is_required ? "필수" : "선택"}
                </span>
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
                      <input name="is_active" type="checkbox" defaultChecked={v.is_active} className="h-4 w-4 accent-[#102a43]" />
                      노출
                    </label>
                    <SubmitButton className="h-9">저장</SubmitButton>
                  </ActionForm>
                ))}
              </div>
              <ActionForm action={createAddonValue} className="flex flex-wrap items-end gap-2 border-t border-dashed border-line bg-soft/30 px-4 py-3">
                <input type="hidden" name="group_id" value={g.id} />
                <label className="text-xs font-semibold">
                  옵션명
                  <input name="label" className={`${input} mt-1 block w-40`} required />
                </label>
                <label className="text-xs font-semibold">
                  추가금
                  <input name="price" type="number" min={0} step={1000} defaultValue={0} className={`${input} mt-1 block w-28`} />
                </label>
                <label className="flex items-center gap-1.5 pb-2.5 text-xs">
                  <input name="is_default" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 기본 선택
                </label>
                <label className="flex items-center gap-1.5 pb-2.5 text-xs">
                  <input name="is_quote_required" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 현장 견적
                </label>
                <SubmitButton className="h-10">옵션 추가</SubmitButton>
              </ActionForm>
            </div>
          ))}
        </div>

        <ActionForm action={createAddonGroup} className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-4">
          <input type="hidden" name="product_id" value={p.id} />
          <label className="text-[13px] font-semibold">
            옵션 그룹명
            <input name="name" className={`${input} mt-1 block w-44`} required placeholder="설치 방식" />
          </label>
          <label className="text-[13px] font-semibold">
            선택 방식
            <select name="select_type" className={`${input} mt-1 block w-32`}>
              <option value="single">단일 선택</option>
              <option value="multi">복수 선택</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2.5 text-[13px] font-semibold">
            <input name="is_required" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 필수
          </label>
          <SubmitButton>그룹 추가</SubmitButton>
        </ActionForm>
      </section>

      <p className="text-xs text-sub">
        추가금 참고: 모델·SKU별 추가금은 패키지마다 다르게 설정합니다(패키지 관리). 여기서 정하는 추가금은 부가 옵션 금액입니다. {won(0)} 옵션은 “무료”로 표시됩니다.
      </p>
    </div>
  );
}