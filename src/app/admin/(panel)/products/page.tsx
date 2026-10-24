import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";
import { STORE_CATEGORIES, STORE_CATEGORY_LABEL } from "@/lib/store";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { createProduct, quickCreateProduct, toggleStoreVisible } from "./actions";

const TYPES = ["TV", "사운드바", "냉장고", "김치냉장고", "식기세척기", "인덕션", "정수기", "세탁기", "건조기", "세탁건조기", "의류관리기", "에어컨", "공기청정기", "제습기", "무선청소기", "로봇청소기"];

type Price = { sale_price: number; list_price: number; is_active: boolean };
type Row = {
  id: string;
  name: string;
  product_type: string;
  status: string;
  store_visible: boolean;
  store_category: string | null;
  brand: { name: string; slug: string } | null;
  product_models: {
    model_code: string;
    status: string;
    product_skus: { id: string; stock: number; status: string; store_prices: Price | Price[] | null }[];
  }[];
};

type SP = Promise<{ brand?: string; cat?: string; vis?: string; q?: string }>;

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default function AdminProductsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">제품·옵션</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <ProductsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductsView({ searchParams }: { searchParams: SP }) {
  await connection();
  await requireStaff("products");
  const { brand = "", cat = "", vis = "", q = "" } = await searchParams;
  const sb = createAdminClient();

  const [{ data: products }, { data: brands }] = await Promise.all([
    sb
      .from("products")
      .select(
        "id, name, product_type, status, store_visible, store_category, brand:brands(name, slug), product_models(model_code, status, product_skus(id, stock, status, store_prices(sale_price, list_price, is_active)))"
      )
      .order("created_at", { ascending: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true }),
    sb.from("brands").select("id, name, slug").order("sort_order"),
  ]);

  const all = (products ?? []) as unknown as Row[];
  const keyword = q.trim().toLowerCase();
  const rows = all.filter((p) => {
    if (brand && p.brand?.slug !== brand) return false;
    if (cat === "none" ? !!p.store_category : cat && p.store_category !== cat) return false;
    if (vis === "y" && !p.store_visible) return false;
    if (vis === "n" && p.store_visible) return false;
    if (keyword) {
      const hay = [p.name, p.product_type, ...p.product_models.map((m) => m.model_code)].join(" ").toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });

  const href = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({ ...(brand && { brand }), ...(cat && { cat }), ...(vis && { vis }), ...(q && { q }) });
    for (const [k, v] of Object.entries(patch)) v ? sp.set(k, v) : sp.delete(k);
    const s = sp.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-navy text-white" : "bg-white hover:bg-white/70"}`;

  return (
    <div className="mt-6 space-y-5">
      {/* 간편 등록 */}
      <details open className="rounded-xl bg-white">
        <summary className="cursor-pointer list-none p-5 font-bold">
          간편 등록 <span className="ml-2 text-sm font-normal text-sub">모델 1개 · 크기/색상 선택이 없는 제품</span>
        </summary>
        <ActionForm action={quickCreateProduct} className="grid gap-3 border-t border-line p-5 md:grid-cols-4">
          <label className="text-[13px] font-semibold">
            브랜드 *
            <select name="brand_id" required defaultValue="" className={`${input} mt-1 block w-full`}>
              <option value="" disabled>선택</option>
              {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            제품종류 *
            <input name="product_type" list="product-types" required placeholder="세탁기" className={`${input} mt-1 block w-full`} />
            <datalist id="product-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            제품명 *
            <input name="name" required maxLength={100} placeholder="LG 트롬 오브제컬렉션 세탁기 (FX24KNTR)" className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            모델코드 *
            <input name="model_code" required placeholder="FX24KNTR" className={`${input} mt-1 block w-full uppercase`} />
          </label>
          <label className="text-[13px] font-semibold">
            모델명 <span className="font-normal text-sub">(비우면 제품명)</span>
            <input name="model_name" className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            SKU코드 <span className="font-normal text-sub">(비우면 자동)</span>
            <input name="sku" placeholder="DT-LG-FX24KNTR" className={`${input} mt-1 block w-full uppercase`} />
          </label>
          <label className="text-[13px] font-semibold">
            재고 *
            <input name="stock" type="number" min={0} defaultValue={20} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            판매가 <span className="font-normal text-sub">(비우면 쇼핑몰 미판매)</span>
            <input name="sale_price" type="number" min={0} step={100} className={`${input} tabular mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            정상가 <span className="font-normal text-sub">(비우면 판매가)</span>
            <input name="list_price" type="number" min={0} step={100} className={`${input} tabular mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            쇼핑몰 분류
            <select name="store_category" defaultValue="" className={`${input} mt-1 block w-full`}>
              <option value="">선택 안 함</option>
              {STORE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-4 pb-2.5 text-sm font-semibold">
            <label className="flex items-center gap-1.5"><input name="store_visible" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 쇼핑몰 노출</label>
            <label className="flex items-center gap-1.5"><input name="bundle_eligible" type="checkbox" defaultChecked className="h-4 w-4 accent-[#102a43]" /> 세트 할인</label>
          </div>
          <label className="text-[13px] font-semibold md:col-span-2">
            이미지 URL <span className="font-normal text-sub">(선택)</span>
            <input name="image_url" placeholder="https://" className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            요약 <span className="font-normal text-sub">(목록 카드에 표시, 선택)</span>
            <input name="store_summary" maxLength={200} placeholder="24kg · 화이트" className={`${input} mt-1 block w-full`} />
          </label>
          <div className="md:col-span-4"><SubmitButton>한 번에 등록</SubmitButton></div>
        </ActionForm>
      </details>

      {/* 옵션이 있는 제품 (기존 방식) */}
      <details className="rounded-xl bg-white">
        <summary className="cursor-pointer list-none p-5 font-bold">
          옵션이 있는 제품 등록 <span className="ml-2 text-sm font-normal text-sub">크기·색상 등을 고객이 고르는 제품 → 등록 후 상세에서 모델·SKU 추가</span>
        </summary>
        <ActionForm action={createProduct} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
          <label className="text-[13px] font-semibold">
            브랜드
            <select name="brand_id" required defaultValue="" className={`${input} mt-1 block w-36`}>
              <option value="" disabled>선택</option>
              {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            제품종류
            <input name="product_type" list="product-types" required className={`${input} mt-1 block w-36`} />
          </label>
          <label className="text-[13px] font-semibold">
            제품명
            <input name="name" required maxLength={100} className={`${input} mt-1 block w-64`} />
          </label>
          <label className="text-[13px] font-semibold">
            선택 항목 (쉼표 구분)
            <input name="attribute_keys" placeholder="화면 크기, 색상" className={`${input} mt-1 block w-56`} />
          </label>
          <input type="hidden" name="description" value="" />
          <SubmitButton>등록 후 상세로</SubmitButton>
        </ActionForm>
      </details>

      {/* 필터 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ brand: "" })} className={chip(!brand)}>전체 브랜드</Link>
          {(brands ?? []).map((b) => <Link key={b.slug} href={href({ brand: b.slug })} className={chip(brand === b.slug)}>{b.name}</Link>)}
          <span className="mx-1 h-5 w-px bg-line" />
          <Link href={href({ vis: "" })} className={chip(!vis)}>노출 전체</Link>
          <Link href={href({ vis: "y" })} className={chip(vis === "y")}>노출 중</Link>
          <Link href={href({ vis: "n" })} className={chip(vis === "n")}>숨김</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ cat: "" })} className={chip(!cat)}>전체 분류</Link>
          {STORE_CATEGORIES.map((c) => <Link key={c.key} href={href({ cat: c.key })} className={chip(cat === c.key)}>{c.label}</Link>)}
          <Link href={href({ cat: "none" })} className={chip(cat === "none")}>분류 없음</Link>
          <form action="/admin/products" className="ml-auto flex gap-2">
            {brand && <input type="hidden" name="brand" value={brand} />}
            {cat && <input type="hidden" name="cat" value={cat} />}
            {vis && <input type="hidden" name="vis" value={vis} />}
            <input name="q" defaultValue={q} placeholder="제품명·모델코드" className={`${input} w-52 bg-white`} />
            <button className="h-10 rounded-lg bg-navy px-4 text-sm font-bold text-white">검색</button>
          </form>
        </div>
      </div>

      {/* 목록 */}
      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-line text-left text-[13px] text-sub">
            <tr>
              <th className="px-4 py-3 font-semibold">브랜드</th>
              <th className="px-4 py-3 font-semibold">분류 · 종류</th>
              <th className="px-4 py-3 font-semibold">제품명 · 모델</th>
              <th className="px-4 py-3 text-right font-semibold">판매가</th>
              <th className="px-4 py-3 text-right font-semibold">재고</th>
              <th className="px-4 py-3 font-semibold">쇼핑몰</th>
              <th className="px-4 py-3 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-14 text-center text-sub">조건에 맞는 제품이 없습니다.</td></tr>
            )}
            {rows.map((p) => {
              const skus = p.product_models.flatMap((m) => m.product_skus);
              const stock = skus.filter((s) => s.status !== "inactive").reduce((a, s) => a + s.stock, 0);
              const prices = skus.map((s) => one(s.store_prices)).filter((x): x is Price => !!x && x.is_active).map((x) => x.sale_price);
              const min = prices.length ? Math.min(...prices) : null;
              const max = prices.length ? Math.max(...prices) : null;
              const codes = p.product_models.map((m) => m.model_code);
              return (
                <tr key={p.id} className="align-middle hover:bg-soft/60">
                  <td className="px-4 py-3">{p.brand?.name}</td>
                  <td className="px-4 py-3">
                    {p.store_category ? STORE_CATEGORY_LABEL[p.store_category] : <span className="text-coral">분류 없음</span>}
                    <span className="block text-xs text-sub">{p.product_type}</span>
                  </td>
                  <td className="max-w-80 px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-bold text-navy hover:underline">{p.name}</Link>
                    <span className="block truncate text-xs text-sub">
                      {codes.slice(0, 2).join(", ")}{codes.length > 2 && ` 외 ${codes.length - 2}`} · SKU {skus.length}개
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {min === null ? <span className="text-sub">미판매</span> : min === max ? won(min) : `${won(min)}~`}
                  </td>
                  <td className={`px-4 py-3 text-right ${stock === 0 ? "font-bold text-coral" : ""}`}>{stock}</td>
                  <td className="px-4 py-3">
                    <ActionForm action={toggleStoreVisible} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="visible" value={p.store_visible ? "0" : "1"} />
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          p.store_visible ? "bg-navy text-white hover:bg-navy-700" : "bg-soft text-sub hover:bg-line"
                        }`}
                        title={p.store_visible ? "누르면 숨김" : "누르면 노출"}
                      >
                        {p.store_visible ? "노출 중" : "숨김"}
                      </button>
                    </ActionForm>
                  </td>
                  <td className="px-4 py-3">{p.status === "active" ? "판매중" : <span className="text-sub">판매중지</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub">총 {rows.length}개 · 쇼핑몰 노출은 분류와 판매가가 있어야 켤 수 있습니다.</p>
    </div>
  );
}