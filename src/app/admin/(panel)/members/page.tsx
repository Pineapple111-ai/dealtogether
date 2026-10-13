import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { issueTempPassword, setSuspended, saveMemberMemo } from "./actions";

type SP = Promise<{ q?: string; page?: string }>;
type Member = {
  id: string; name: string | null; phone: string | null; email: string | null;
  marketing_agreed: boolean; is_suspended: boolean; admin_memo: string | null; created_at: string;
};

const PAGE_SIZE = 30;

export default function AdminMembersPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">회원</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <MembersView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MembersView({ searchParams }: { searchParams: SP }) {
  await connection();
  await requireStaff("members");
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const keyword = q.trim().slice(0, 30).replace(/[%_,()]/g, "");
  const db = createAdminClient();

  let query = db
    .from("profiles")
    .select("id, name, phone, email, marketing_agreed, is_suspended, admin_memo, created_at", { count: "exact" })
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);
  if (keyword) {
    query = /^[0-9-]+$/.test(keyword) ? query.ilike("phone", `%${keyword}%`) : query.ilike("name", `%${keyword}%`);
  }

  const { data, count } = await query;
  const members = (data ?? []) as Member[];

  // 회원별 주문 수
  const ids = members.map((m) => m.id);
  const { data: orders } = ids.length
    ? await db.from("orders").select("user_id, status").in("user_id", ids)
    : { data: [] as { user_id: string; status: string }[] };
  const orderCount = new Map<string, number>();
  for (const o of orders ?? []) orderCount.set(o.user_id, (orderCount.get(o.user_id) ?? 0) + 1);

  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);
  const href = (p: number) => `/admin/members?${new URLSearchParams({ ...(keyword && { q: keyword }), page: String(p) })}`;

  return (
    <div className="mt-5 space-y-3">
      <form action="/admin/members" className="flex gap-2">
        <input name="q" defaultValue={keyword} placeholder="이름 또는 휴대폰 번호" className="h-10 w-64 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-navy" />
        <button className="h-10 rounded-lg bg-navy px-4 text-sm font-bold text-white">검색</button>
        <span className="ml-auto self-center text-sm text-sub">총 {count ?? 0}명</span>
      </form>

      {members.length === 0 && <p className="rounded-xl bg-white p-10 text-center text-sm text-sub">회원이 없습니다.</p>}

      {members.map((m) => (
        <details key={m.id} className="rounded-xl bg-white">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 text-sm">
            <b className="w-28 truncate">{m.name ?? "-"}</b>
            <span className="tabular w-32">{m.phone ?? m.email ?? "-"}</span>
            {m.is_suspended && <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-white">정지</span>}
            {m.marketing_agreed && <span className="text-xs text-navy">마케팅 동의</span>}
            {m.admin_memo && <span className="max-w-60 truncate text-xs text-sub">메모: {m.admin_memo}</span>}
            <span className="tabular ml-auto text-xs text-sub">주문 {orderCount.get(m.id) ?? 0}건 · 가입 {formatDate(m.created_at, false)}</span>
          </summary>

          <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-3">
            <div className="space-y-3">
              <h3 className="text-sm font-bold">비밀번호</h3>
              <ActionForm action={issueTempPassword} className="space-y-2">
                <input type="hidden" name="id" value={m.id} />
                <SubmitButton>임시 비밀번호 발급</SubmitButton>
              </ActionForm>
              <p className="text-xs text-sub">본인 확인 후 발급하세요. 발급 즉시 기존 비밀번호는 사용할 수 없습니다.</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold">계정 상태</h3>
              <ActionForm action={setSuspended}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="suspend" value={m.is_suspended ? "0" : "1"} />
                <SubmitButton className={m.is_suspended ? "" : "bg-white !text-coral ring-1 ring-coral hover:!bg-coral/5"}>
                  {m.is_suspended ? "정지 해제" : "계정 정지"}
                </SubmitButton>
              </ActionForm>
              <Link href={`/admin/orders?q=${encodeURIComponent(m.phone ?? "")}`} className="block text-sm text-navy underline">
                이 번호로 주문 검색
              </Link>
            </div>

            <ActionForm action={saveMemberMemo} className="space-y-2">
              <input type="hidden" name="id" value={m.id} />
              <h3 className="text-sm font-bold">관리자 메모</h3>
              <textarea name="admin_memo" defaultValue={m.admin_memo ?? ""} maxLength={2000} className="h-24 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy" />
              <SubmitButton>저장</SubmitButton>
            </ActionForm>
          </div>
        </details>
      ))}

      <div className="flex justify-end gap-2 text-sm">
        {pageNum > 1 && <Link href={href(pageNum - 1)} className="rounded-lg bg-white px-3 py-1.5">이전</Link>}
        <span className="px-2 py-1.5 text-sub">{pageNum} / {totalPages}</span>
        {pageNum < totalPages && <Link href={href(pageNum + 1)} className="rounded-lg bg-white px-3 py-1.5">다음</Link>}
      </div>
    </div>
  );
}