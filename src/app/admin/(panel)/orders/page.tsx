import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { won, formatDate } from "@/lib/format";

const PAGE_SIZE = 30;

const TABS = [
  { key: "", label: "전체" },
  { key: "pending_payment", label: "결제 대기" },
  { key: "payment_verification", label: "결제 확인 중" },
  { key: "paid", label: "결제 완료" },
  { key: "preparing", label: "상품 준비" },
  { key: "shipping", label: "배송 중" },
  { key: "cancelled", label: "취소" },
  { key: "expired", label: "만료" },
  { key: "refunded", label: "환불" },
];

type SP = Promise<{ status?: string; q?: string; page?: string }>;

type Row = {
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  quantity: number;
  grand_total: number;
  status: string;
  expires_at: string;
  created_at: string;
  campaign_snapshot: { package_name: string; campaign_name: string };
  payment_records: { status: string; amount_mismatch: boolean; created_at: string }[];
};

export default function AdminOrdersPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">주문·결제</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <OrdersTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersTable({ searchParams }: { searchParams: SP }) {
  await connection();
  await requireStaff("orders");
  const { status = "", q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const keyword = q.trim().slice(0, 50);

  let query = createAdminClient()
    .from("orders")
    .select(
      "order_number, buyer_name, buyer_phone, quantity, grand_total, status, expires_at, created_at, campaign_snapshot, payment_records(status, amount_mismatch, created_at)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

  if (TABS.some((t) => t.key === status && t.key)) query = query.eq("status", status);

  if (keyword) {
    const safe = keyword.replace(/[%_,()]/g, "");
    if (/^DT-/i.test(safe)) query = query.ilike("order_number", `%${safe.toUpperCase()}%`);
    else if (/^[0-9-]+$/.test(safe)) query = query.ilike("buyer_phone", `%${safe}%`);
    else query = query.ilike("buyer_name", `%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return <p className="mt-6 text-sm text-coral">조회 실패: {error.message}</p>;

  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);
  const now = Date.now();
  const qs = (p: Record<string, string>) =>
    "?" + new URLSearchParams({ ...(status && { status }), ...(keyword && { q: keyword }), ...p }).toString();

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders${t.key ? `?status=${t.key}` : ""}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              status === t.key ? "bg-navy text-white" : "bg-white text-ink hover:bg-white/70"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/orders">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={keyword}
            placeholder="주문번호 / 주문자 / 휴대폰"
            className="h-10 w-60 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-navy"
          />
          <button className="h-10 rounded-lg bg-navy px-4 text-sm font-bold text-white">검색</button>
        </form>
      </div>

      <form action="/api/admin/orders/export" method="get" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {status && <input type="hidden" name="status" value={status} />}
        {keyword && <input type="hidden" name="q" value={keyword} />}
        <span className="text-sub">주문일</span>
        <input type="date" name="from" className="h-9 rounded-lg border border-line bg-white px-2" />
        <span className="text-sub">~</span>
        <input type="date" name="to" className="h-9 rounded-lg border border-line bg-white px-2" />
        <button className="h-9 rounded-lg border border-navy bg-white px-4 font-bold text-navy hover:bg-navy/5">
          CSV 다운로드
        </button>
        <span className="text-xs text-sub">현재 상태 필터·검색어가 적용됩니다. 기간을 비우면 전체 기간입니다.</span>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-[13px] text-sub">
            <tr>
              <th className="px-4 py-3 font-semibold">주문번호</th>
              <th className="px-4 py-3 font-semibold">주문일시</th>
              <th className="px-4 py-3 font-semibold">주문자</th>
              <th className="px-4 py-3 font-semibold">패키지</th>
              <th className="px-4 py-3 text-right font-semibold">수량</th>
              <th className="px-4 py-3 text-right font-semibold">주문금액</th>
              <th className="px-4 py-3 font-semibold">주문 상태</th>
              <th className="px-4 py-3 font-semibold">결제 기록</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sub">주문이 없습니다.</td>
              </tr>
            )}
            {rows.map((o) => {
              const pr = [...o.payment_records].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              const expired =
                (o.status === "pending_payment" || o.status === "payment_verification") &&
                new Date(o.expires_at).getTime() <= now;
              return (
                <tr key={o.order_number} className="hover:bg-soft/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.order_number}`} className="font-bold text-navy hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sub">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">
                    {o.buyer_name}
                    <span className="block text-xs text-sub">{o.buyer_phone}</span>
                  </td>
                  <td className="max-w-56 truncate px-4 py-3">{o.campaign_snapshot?.package_name}</td>
                  <td className="px-4 py-3 text-right">{o.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold">{won(o.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={expired ? "text-sub" : o.status === "paid" ? "font-bold text-navy" : ""}>
                      {expired ? "기한 만료(처리 대기)" : ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pr ? PAYMENT_STATUS_LABEL[pr.status] ?? pr.status : "-"}
                    {pr?.amount_mismatch && <span className="ml-1 font-bold text-coral">금액 불일치</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-sub">
        <span>총 {count ?? 0}건</span>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link href={`/admin/orders${qs({ page: String(pageNum - 1) })}`} className="rounded-lg bg-white px-3 py-1.5">이전</Link>
          )}
          <span className="px-2 py-1.5">{pageNum} / {totalPages}</span>
          {pageNum < totalPages && (
            <Link href={`/admin/orders${qs({ page: String(pageNum + 1) })}`} className="rounded-lg bg-white px-3 py-1.5">다음</Link>
          )}
        </div>
      </div>
    </>
  );
}