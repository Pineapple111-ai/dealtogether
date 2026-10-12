import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { createPackage } from "./actions";

type Row = {
  id: string; name: string; slug: string; product_code: string | null; list_price: number; status: string;
  brand: { name: string }; category: { name: string };
  package_items: { id: string; is_required: boolean }[];
  campaigns: { id: string }[];
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminPackagesPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">패키지</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <PackagesView />
      </Suspense>
    </div>
  );
}

async function PackagesView() {
  await connection();
  await requireStaff("products");
  const sb = createAdminClient();
  const [{ data }, { data: brands }, { data: categories }] = await Promise.all([
    sb
      .from("packages")
      .select("id, name, slug, product_code, list_price, status, brand:brands(name), category:categories(name), package_items(id, is_required), campaigns(id)")
      .order("created_at", { ascending: false }),
    sb.from("brands").select("id, name").order("sort_order"),
    sb.from("categories").select("id, name").order("sort_order"),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">새 패키지 만들기</h2>
        <ActionForm action={createPackage} className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-semibold">
            브랜드
            <select name="brand_id" required defaultValue="" className={`${input} mt-1 block w-32`}>
              <option value="" disabled>선택</option>
              {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            공간
            <select name="category_id" required defaultValue="" className={`${input} mt-1 block w-32`}>
              <option value="" disabled>선택</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            패키지명
            <input name="name" required maxLength={100} className={`${input} mt-1 block w-60`} placeholder="LG 거실 프리미엄 패키지" />
          </label>
          <label className="text-[13px] font-semibold">
            주소(slug)
            <input name="slug" required className={`${input} mt-1 block w-48 lowercase`} placeholder="lg-living-premium" />
          </label>
          <label className="text-[13px] font-semibold">
            상품코드 (선택)
            <input name="product_code" className={`${input} mt-1 block w-32 uppercase`} placeholder="PKG-001" />
          </label>
          <label className="text-[13px] font-semibold">
            정상가 (원)
            <input name="list_price" type="number" min={0} step={1000} required className={`${input} mt-1 block w-36`} />
          </label>
          <input type="hidden" name="summary" value="" />
          <SubmitButton>만들기</SubmitButton>
        </ActionForm>
        <p className="mt-3 text-xs text-sub">정상가는 할인율 표시 기준입니다. 실제 공동구매 판매가는 캠페인에서 정합니다.</p>
      </section>

      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-[13px] text-sub">
            <tr>
              <th className="px-4 py-3 font-semibold">브랜드</th>
              <th className="px-4 py-3 font-semibold">공간</th>
              <th className="px-4 py-3 font-semibold">패키지명</th>
              <th className="px-4 py-3 font-semibold">상품코드</th>
              <th className="px-4 py-3 text-right font-semibold">정상가</th>
              <th className="px-4 py-3 text-right font-semibold">구성품</th>
              <th className="px-4 py-3 text-right font-semibold">캠페인</th>
              <th className="px-4 py-3 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-14 text-center text-sub">등록된 패키지가 없습니다.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-soft/60">
                <td className="px-4 py-3">{p.brand?.name}</td>
                <td className="px-4 py-3">{p.category?.name}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/packages/${p.id}`} className="font-bold text-navy hover:underline">{p.name}</Link>
                </td>
                <td className="px-4 py-3 text-sub">{p.product_code ?? "-"}</td>
                <td className="px-4 py-3 text-right">{won(p.list_price)}</td>
                <td className="px-4 py-3 text-right">
                  필수 {p.package_items.filter((i) => i.is_required).length} · 선택 {p.package_items.filter((i) => !i.is_required).length}
                </td>
                <td className="px-4 py-3 text-right">{p.campaigns.length}</td>
                <td className="px-4 py-3">{p.status === "active" ? "판매중" : <span className="text-sub">판매중지</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}