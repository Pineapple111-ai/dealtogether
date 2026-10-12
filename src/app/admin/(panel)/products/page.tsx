import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { createProduct } from "./actions";

const TYPES = ["TV", "사운드바", "냉장고", "식기세척기", "인덕션", "세탁기", "건조기", "의류관리기", "에어컨", "공기청정기", "제습기", "무선청소기", "로봇청소기"];

type Row = {
  id: string;
  name: string;
  product_type: string;
  status: string;
  attribute_keys: string[];
  brand: { name: string };
  product_models: { id: string; status: string; product_skus: { stock: number; status: string }[] }[];
};

export default function AdminProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">제품·옵션</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <ProductsView />
      </Suspense>
    </div>
  );
}

async function ProductsView() {
  await connection();
  await requireStaff("products");
  const sb = createAdminClient();
  const [{ data: products }, { data: brands }] = await Promise.all([
    sb
      .from("products")
      .select("id, name, product_type, status, attribute_keys, brand:brands(name), product_models(id, status, product_skus(stock, status))")
      .order("created_at", { ascending: false }),
    sb.from("brands").select("id, name").order("sort_order"),
  ]);

  const rows = (products ?? []) as unknown as Row[];
  const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">새 제품 등록</h2>
        <ActionForm action={createProduct} className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-semibold">
            브랜드
            <select name="brand_id" className={`${input} mt-1 block w-36`} required defaultValue="">
              <option value="" disabled>선택</option>
              {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            제품 종류
            <input name="product_type" list="product-types" className={`${input} mt-1 block w-36`} required placeholder="TV" />
            <datalist id="product-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="text-[13px] font-semibold">
            제품명
            <input name="name" className={`${input} mt-1 block w-64`} required placeholder="LG OLED TV" maxLength={100} />
          </label>
          <label className="text-[13px] font-semibold">
            선택 항목 (쉼표 구분, 순서대로 종속)
            <input name="attribute_keys" className={`${input} mt-1 block w-64`} placeholder="화면 크기, 색상" />
          </label>
          <input type="hidden" name="description" value="" />
          <SubmitButton>등록</SubmitButton>
        </ActionForm>
        <p className="mt-3 text-xs text-sub">
          선택 항목은 고객이 고르는 순서입니다. 예: TV는 “화면 크기, 색상”, 세탁기는 “용량, 색상”. 설치 방식처럼 추가금이 붙는 선택은 제품 상세의 부가 옵션으로 등록합니다.
        </p>
      </section>

      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-[13px] text-sub">
            <tr>
              <th className="px-4 py-3 font-semibold">브랜드</th>
              <th className="px-4 py-3 font-semibold">종류</th>
              <th className="px-4 py-3 font-semibold">제품명</th>
              <th className="px-4 py-3 font-semibold">선택 항목</th>
              <th className="px-4 py-3 text-right font-semibold">모델</th>
              <th className="px-4 py-3 text-right font-semibold">SKU</th>
              <th className="px-4 py-3 text-right font-semibold">총 재고</th>
              <th className="px-4 py-3 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-14 text-center text-sub">등록된 제품이 없습니다.</td></tr>
            )}
            {rows.map((p) => {
              const skus = p.product_models.flatMap((m) => m.product_skus);
              const stock = skus.filter((s) => s.status !== "inactive").reduce((a, s) => a + s.stock, 0);
              return (
                <tr key={p.id} className="hover:bg-soft/60">
                  <td className="px-4 py-3">{p.brand?.name}</td>
                  <td className="px-4 py-3">{p.product_type}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-bold text-navy hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sub">{p.attribute_keys.join(" → ") || "-"}</td>
                  <td className="px-4 py-3 text-right">{p.product_models.length}</td>
                  <td className="px-4 py-3 text-right">{skus.length}</td>
                  <td className={`px-4 py-3 text-right ${stock === 0 ? "font-bold text-coral" : ""}`}>{stock}</td>
                  <td className="px-4 py-3">{p.status === "active" ? "판매중" : <span className="text-sub">판매중지</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}