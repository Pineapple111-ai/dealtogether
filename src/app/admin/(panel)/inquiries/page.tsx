import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { updateInquiry } from "./actions";

const STATUS: Record<string, string> = { new: "신규", in_progress: "진행 중", done: "처리 완료" };
const input = "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

type Row = {
  id: string; user_id: string | null; name: string; phone: string; email: string | null; category: string;
  order_number: string | null; content: string; status: string; assignee_id: string | null;
  admin_memo: string | null; answer: string | null; answered_at: string | null; created_at: string;
  campaign: { name: string; slug: string } | null;
};

type SP = Promise<{ status?: string }>;

export default function AdminInquiriesPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">상담</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <InquiriesView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function InquiriesView({ searchParams }: { searchParams: SP }) {
  await connection();
  await requireStaff("cs");
  const { status = "" } = await searchParams;
  const db = createAdminClient();

  let q = db
    .from("inquiries")
    .select("*, campaign:campaigns(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (STATUS[status]) q = q.eq("status", status);

  const [{ data }, { data: staff }, { count: newCount }] = await Promise.all([
    q,
    db.from("profiles").select("id, name, email").neq("role", "customer"),
    db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const staffName = (id: string | null) => {
    const s = staff?.find((x) => x.id === id);
    return s ? s.name ?? s.email : "미배정";
  };

  return (
    <div className="mt-5 space-y-3">
      <div className="flex gap-2">
        {[["", "전체"], ["new", `신규 ${newCount ?? 0}`], ["in_progress", "진행 중"], ["done", "처리 완료"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/inquiries?status=${k}` : "/admin/inquiries"} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === k ? "bg-navy text-white" : "bg-white"}`}>
            {l}
          </Link>
        ))}
      </div>

      {rows.length === 0 && <p className="rounded-xl bg-white p-10 text-center text-sm text-sub">문의가 없습니다.</p>}

      {rows.map((r) => (
        <details key={r.id} className="rounded-xl bg-white" open={r.status === "new"}>
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === "new" ? "bg-coral text-white" : r.status === "in_progress" ? "bg-navy text-white" : "bg-soft text-sub"}`}>
              {STATUS[r.status]}
            </span>
            <span className="rounded bg-soft px-2 py-0.5 text-xs">{r.category}</span>
            <b>{r.name}</b>
            <span className="tabular text-sub">{r.phone}</span>
            {r.user_id ? <span className="text-xs text-navy">회원</span> : <span className="text-xs text-sub">비회원</span>}
            <span className="flex-1 truncate text-sub">{r.content}</span>
            <span className="text-xs text-sub">{staffName(r.assignee_id)}</span>
            <span className="tabular text-xs text-sub">{formatDate(r.created_at)}</span>
          </summary>

          <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              {r.campaign && (
                <p>관심 패키지: <Link href={`/campaigns/${r.campaign.slug}`} target="_blank" className="font-semibold text-navy underline">{r.campaign.name}</Link></p>
              )}
              {r.order_number && (
                <p>주문번호: <Link href={`/admin/orders/${r.order_number}`} className="tabular font-semibold text-navy underline">{r.order_number}</Link></p>
              )}
              {r.email && <p>이메일: {r.email}</p>}
              <p className="whitespace-pre-line rounded-lg bg-soft p-4 leading-relaxed">{r.content}</p>
            </div>

            <ActionForm action={updateInquiry} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[13px] font-semibold">
                  상태
                  <select name="status" defaultValue={r.status} className={`${input} mt-1`}>
                    {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <label className="text-[13px] font-semibold">
                  담당자
                  <select name="assignee_id" defaultValue={r.assignee_id ?? ""} className={`${input} mt-1`}>
                    <option value="">미배정</option>
                    {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-[13px] font-semibold">
                내부 메모 (고객에게 보이지 않음)
                <textarea name="admin_memo" defaultValue={r.admin_memo ?? ""} className={`${input} mt-1 h-20 py-2`} />
              </label>
              <label className="block text-[13px] font-semibold">
                답변 {r.user_id ? "(회원 마이페이지에 표시)" : "(비회원: 전화·문자로 안내 후 기록용)"}
                <textarea name="answer" defaultValue={r.answer ?? ""} className={`${input} mt-1 h-28 py-2`} />
              </label>
              {r.answered_at && <p className="tabular text-xs text-sub">답변 일시 {formatDate(r.answered_at)}</p>}
              <SubmitButton>저장</SubmitButton>
            </ActionForm>
          </div>
        </details>
      ))}
    </div>
  );
}