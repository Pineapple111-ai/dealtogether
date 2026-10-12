import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import {
  updatePackage, duplicatePackage, addPackageItem, updatePackageItem, deletePackageItem, savePackageItemSkus,
} from "../actions";

type Params = { params: Promise<{ id: string }> };

type Sku = { id: string; sku: string; attributes: Record<string, string>; status: string; stock: number };
type Model = { id: string; model_code: string; model_name: string; status: string; sort_order: number; product_skus: Sku[] };
type Item = {
  id: string; label: string; is_required: boolean; optional_price: number; quantity: number; sort_order: number;
  product: { id: string; name: string; product_type: string; product_models: Model[] } | null;
  package_item_skus: { sku_id: string; price_adjustment: number; is_default: boolean }[];
};
type Pkg = {
  id: string; name: string; slug: string; product_code: string | null; summary: string | null; description: string | null;
  list_price: number; thumbnail_url: string | null; images: string[]; status: string; category_id: string;
  brand: { id: string; name: string }; package_items: Item[]; campaigns: { id: string; name: string; slug: string }[];
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminPackageDetail({ params }: Params) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
      <PackageDetail params={params} />
    </Suspense>
  );
}

async function PackageDetail({ params }: Params) {
  await connection();
  await requireStaff("products");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const sb = createAdminClient();
  const [{ data }, { data: categories }, { data: products }] = await Promise.all([
    sb
      .from("packages")
      .select(`*, brand:brands(id, name), campaigns(id, name, slug),
        package_items(*, package_item_skus(*),
          product:products(id, name, product_type, product_models(id, model_code, model_name, status, sort_order, product_skus(id, sku, attributes, status, stock))))`)
      .eq("id", id)
      .maybeSingle(),
    sb.from("categories").select("id, name").order("sort_order"),
    sb.from("products").select("id, name, product_type, brand:brands(name)").eq("status", "active").order("product_type"),
  ]);
  if (!data) notFound();
  const p = data as unknown as Pkg;
  const items = [...p.package_items].sort((a, b) => a.sort_order - b.sort_order);
  const productOpts = (products ?? []) as unknown as { id: string; name: string; product_type: string; brand: { name: string } }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/packages" className="text-sm text-sub hover:text-ink">← 패키지 목록</Link>
          <h1 className="mt-2 text-2xl font-extrabold">{p.name}</h1>
          <p className="text-sm text-sub">
            {p.brand.name} · 연결된 캠페인 {p.campaigns.length}개
            {p.campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.slug}`} target="_blank" className="ml-2 text-navy underline">{c.name}</Link>
            ))}
          </p>
        </div>
        <ActionForm action={duplicatePackage}>
          <input type="hidden" name="id" value={p.id} />
          <SubmitButton className="bg-white !text-navy ring-1 ring-navy hover:!bg-navy/5">패키지 복제</SubmitButton>
        </ActionForm>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">기본 정보</h2>
        <ActionForm action={updatePackage} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="text-[13px] font-semibold md:col-span-2">
            패키지명
            <input name="name" defaultValue={p.name} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            상태
            <select name="status" defaultValue={p.status} className={`${input} mt-1 block w-full`}>
              <option value="active">판매중</option>
              <option value="inactive">판매중지</option>
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            공간
            <select name="category_id" defaultValue={p.category_id} className={`${input} mt-1 block w-full`}>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            주소(slug)
            <input name="slug" defaultValue={p.slug} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            상품코드
            <input name="product_code" defaultValue={p.product_code ?? ""} className={`${input} mt-1 block w-full uppercase`} />
          </label>
          <label className="text-[13px] font-semibold">
            정상가 (원)
            <input name="list_price" type="number" min={0} step={1000} defaultValue={p.list_price} className={`${input} tabular mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            구성 요약 (카드에 표시)
            <input name="summary" defaultValue={p.summary ?? ""} maxLength={200} className={`${input} mt-1 block w-full`} placeholder="OLED TV + 사운드바" />
          </label>
          <label className="text-[13px] font-semibold md:col-span-3">
            대표 이미지 URL
            <input name="thumbnail_url" defaultValue={p.thumbnail_url ?? ""} className={`${input} mt-1 block w-full`} placeholder="https://" />
          </label>
          <label className="text-[13px] font-semibold md:col-span-3">
            추가 이미지 URL (한 줄에 하나)
            <textarea name="images" defaultValue={(p.images ?? []).join("\n")} className={`${input} mt-1 block h-20 w-full py-2`} />
          </label>
          <label className="text-[13px] font-semibold md:col-span-3">
            상세 설명
            <textarea name="description" defaultValue={p.description ?? ""} maxLength={10000} className={`${input} mt-1 block h-32 w-full py-2`} />
          </label>
          <div><SubmitButton>저장</SubmitButton></div>
        </ActionForm>
      </section>

      {/* 구성품 */}
      {items.map((it) => {
        const allowed = new Map(it.package_item_skus.map((s) => [s.sku_id, s]));
        const models = [...(it.product?.product_models ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        const noSku = it.package_item_skus.length === 0;
        return (
          <section key={it.id} className={`rounded-xl bg-white p-5 ${noSku ? "ring-2 ring-coral/40" : ""}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="font-bold">{it.label}</h2>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${it.is_required ? "bg-navy text-white" : "bg-soft text-sub"}`}>
                {it.is_required ? "필수" : "선택"}
              </span>
              <span className="text-sm text-sub">{it.product?.name}</span>
              {noSku && <span className="text-sm font-bold text-coral">허용 SKU가 없어 고객이 선택할 수 없습니다</span>}
            </div>

            <ActionForm action={updatePackageItem} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-soft/60 p-3">
              <input type="hidden" name="id" value={it.id} />
              <label className="text-xs font-semibold">
                표시명
                <input name="label" defaultValue={it.label} className={`${input} mt-1 block w-32`} />
              </label>
              <label className="text-xs font-semibold">
                구분
                <select name="kind" defaultValue={it.is_required ? "required" : "optional"} className={`${input} mt-1 block w-28`}>
                  <option value="required">필수</option>
                  <option value="optional">선택</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                선택 구성품 금액
                <input name="optional_price" type="number" min={0} step={1000} defaultValue={it.optional_price} className={`${input} tabular mt-1 block w-32`} />
              </label>
              <label className="text-xs font-semibold">
                세트당 수량
                <input name="quantity" type="number" min={1} max={10} defaultValue={it.quantity} className={`${input} mt-1 block w-20`} />
              </label>
              <label className="text-xs font-semibold">
                순서
                <input name="sort_order" type="number" defaultValue={it.sort_order} className={`${input} mt-1 block w-16`} />
              </label>
              <SubmitButton className="h-10">저장</SubmitButton>
            </ActionForm>

            <ActionForm action={savePackageItemSkus} className="space-y-3">
              <input type="hidden" name="package_item_id" value={it.id} />
              <p className="text-xs text-sub">고객이 선택할 수 있는 SKU를 체크하고, 기본 SKU 대비 추가금을 입력하세요. 기본 선택은 하나만 지정합니다.</p>
              {models.map((m) => (
                <div key={m.id} className="rounded-lg border border-line">
                  <p className="border-b border-line px-3 py-2 text-sm font-semibold">
                    {m.model_name} <span className="font-normal text-sub">{m.model_code}</span>
                    {m.status !== "active" && <span className="ml-2 text-xs text-coral">판매중지 모델</span>}
                  </p>
                  {m.product_skus.length === 0 && <p className="px-3 py-2 text-xs text-sub">등록된 SKU가 없습니다. 제품·옵션에서 추가하세요.</p>}
                  {m.product_skus.map((s) => {
                    const a = allowed.get(s.id);
                    return (
                      <div key={s.id} className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-sm first:border-t-0">
                        <label className="flex min-w-60 flex-1 items-center gap-2">
                          <input type="checkbox" name={`allow:${s.id}`} defaultChecked={!!a} className="h-4 w-4 accent-[#102a43]" />
                          <span className="font-semibold">{s.sku}</span>
                          <span className="text-sub">{Object.values(s.attributes).join(" · ")}</span>
                          <span className="tabular text-xs text-sub">재고 {s.stock}</span>
                          {s.status !== "active" && <span className="text-xs text-coral">{s.status === "soldout" ? "품절" : "숨김"}</span>}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-sub">
                          추가금
                          <input name={`adj:${s.id}`} type="number" min={0} step={1000} defaultValue={a?.price_adjustment ?? 0} className={`${input} tabular h-9 w-28`} />
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="radio" name="default_sku" value={s.id} defaultChecked={!!a?.is_default} className="h-4 w-4 accent-[#102a43]" />
                          기본
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}
              <SubmitButton>허용 SKU 저장</SubmitButton>
            </ActionForm>

            <ActionForm action={deletePackageItem} className="mt-3 text-right">
              <input type="hidden" name="id" value={it.id} />
              <button className="text-xs text-sub underline hover:text-coral">이 구성품 삭제</button>
            </ActionForm>
          </section>
        );
      })}

      {/* 구성품 추가 */}
      <section className="rounded-xl border-2 border-dashed border-line bg-white p-5">
        <h2 className="mb-4 font-bold">구성품 추가</h2>
        <ActionForm action={addPackageItem} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="package_id" value={p.id} />
          <label className="text-[13px] font-semibold">
            제품
            <select name="product_id" required defaultValue="" className={`${input} mt-1 block w-72`}>
              <option value="" disabled>선택</option>
              {productOpts.map((o) => (
                <option key={o.id} value={o.id}>[{o.brand?.name}] {o.product_type} · {o.name}</option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            표시명
            <input name="label" required className={`${input} mt-1 block w-32`} placeholder="TV" />
          </label>
          <label className="text-[13px] font-semibold">
            구분
            <select name="kind" className={`${input} mt-1 block w-24`}>
              <option value="required">필수</option>
              <option value="optional">선택</option>
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            선택 구성품 금액
            <input name="optional_price" type="number" min={0} step={1000} defaultValue={0} className={`${input} mt-1 block w-32`} />
          </label>
          <label className="text-[13px] font-semibold">
            세트당 수량
            <input name="quantity" type="number" min={1} max={10} defaultValue={1} className={`${input} mt-1 block w-20`} />
          </label>
          <input type="hidden" name="sort_order" value={items.length + 1} />
          <SubmitButton>추가</SubmitButton>
        </ActionForm>
        <p className="mt-3 text-xs text-sub">
          필수 구성품 금액은 캠페인 공동구매가에 포함됩니다. 선택 구성품 금액은 고객이 추가할 때만 더해집니다. 예: 의류관리기 {won(1290000)}
        </p>
      </section>
    </div>
  );
}