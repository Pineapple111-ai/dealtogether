import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL, isAwaitingPayment } from "@/lib/order-status";
import { won, formatDate } from "@/lib/format";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

type OrderRow = {
  order_number: string;
  status: string;
  quantity: number;
  grand_total: number;
  expires_at: string;
  created_at: string;
  campaign_snapshot: { package_name: string; campaign_name: string; brand: string };
};

export default function MyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      <h1 className="text-2xl font-extrabold tracking-tight">마이페이지</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-soft" />}>
        <MyPageContent />
      </Suspense>
    </div>
  );
}

async function MyPageContent() {
  await connection();
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/mypage");

  // RLS: 본인 데이터만 조회됨
  const [{ data: profile }, { data: orders }, { data: inquiries }] = await Promise.all([
    sb.from("profiles").select("name, email, phone").eq("id", user.id).single(),
    sb
      .from("orders")
      .select("order_number, status, quantity, grand_total, expires_at, created_at, campaign_snapshot")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("inquiries")
      .select("id, category, content, status, answer, answered_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const list = (orders ?? []) as OrderRow[];
  const now = Date.now();

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl bg-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-bold">{profile?.name ?? "회원"}님</p>
            <p className="tabular text-sm text-sub">{profile?.phone ?? profile?.email}</p>
          </div>
          <Link href="/order-lookup" className="text-sm text-sub underline underline-offset-4">비회원 주문 조회</Link>
        </div>
        <details className="mt-4 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy">비밀번호 변경</summary>
          <div className="mt-3 max-w-sm">
            <ChangePasswordForm />
          </div>
        </details>
      </section>

      <section>
        <h2 className="text-lg font-bold">주문 내역</h2>
        {list.length === 0 ? (
          <div className="mt-3 rounded-xl border border-line px-6 py-14 text-center">
            <p className="text-sm text-sub">아직 주문 내역이 없습니다.</p>
            <Link href="/campaigns" className="mt-4 inline-block rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white">
              공동구매 둘러보기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {list.map((o) => {
              const awaiting = isAwaitingPayment(o.status, o.expires_at, now);
              const expired =
                !awaiting && (o.status === "pending_payment" || o.status === "payment_verification");
              return (
                <li key={o.order_number} className="rounded-xl border border-line p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tabular text-xs text-sub">
                        {formatDate(o.created_at)} · {o.order_number}
                      </p>
                      <p className="mt-1 text-[13px] font-bold text-sub">{o.campaign_snapshot.brand}</p>
                      <p className="truncate font-bold">{o.campaign_snapshot.package_name}</p>
                      <p className="tabular mt-1 text-sm">
                        {o.quantity}세트 · <b>{won(o.grand_total)}</b>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        awaiting ? "bg-coral/10 text-coral" : o.status === "paid" ? "bg-navy text-white" : "bg-soft text-sub"
                      }`}
                    >
                      {expired ? "결제 기한 만료" : ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/orders/${o.order_number}/pay`}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${
                        awaiting ? "bg-navy text-white" : "border border-line"
                      }`}
                    >
                      {awaiting ? "안전결제 다시 진행하기" : "주문 상세"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
                )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">내 문의</h2>
          <Link href="/support/inquiry" className="text-sm text-sub underline underline-offset-4">1:1 문의하기</Link>
        </div>
        {(inquiries ?? []).length === 0 ? (
          <p className="mt-3 rounded-xl border border-line px-6 py-10 text-center text-sm text-sub">문의 내역이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(inquiries ?? []).map((q) => (
              <li key={q.id} className="rounded-xl border border-line p-5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-soft px-2 py-0.5">{q.category}</span>
                  <span className={q.answer ? "font-bold text-navy" : "text-sub"}>{q.answer ? "답변 완료" : "답변 대기"}</span>
                  <span className="tabular ml-auto text-sub">{formatDate(q.created_at, false)}</span>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm">{q.content}</p>
                {q.answer && (
                  <div className="mt-3 rounded-lg bg-soft p-4 text-sm">
                    <p className="mb-1 font-bold">답변</p>
                    <p className="whitespace-pre-line leading-relaxed">{q.answer}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}