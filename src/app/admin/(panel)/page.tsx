import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-white" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection();
  await requireStaff("dashboard");
  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  const todayKst = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const todayStart = new Date(`${todayKst}T00:00:00+09:00`).toISOString();

  const [today, waiting, verifying, paid, confirmedSum] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment").gt("expires_at", nowIso),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "payment_verification"),
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "preparing", "shipping", "delivered", "installation_scheduled", "completed"]),
    db.from("payment_records").select("confirmed_amount").eq("status", "confirmed"),
  ]);

  const total = (confirmedSum.data ?? []).reduce((s, r) => s + (r.confirmed_amount ?? 0), 0);

  const cards = [
    { label: "오늘 주문", value: `${today.count ?? 0}건`, href: "/admin/orders" },
    { label: "결제 대기", value: `${waiting.count ?? 0}건`, href: "/admin/orders?status=pending_payment" },
    { label: "결제 확인 중", value: `${verifying.count ?? 0}건`, href: "/admin/orders?status=payment_verification" },
    { label: "결제 완료 주문", value: `${paid.count ?? 0}건`, href: "/admin/orders?status=paid" },
    { label: "총 결제 확인금액", value: won(total), href: "/admin/orders?status=paid" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold">대시보드</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl bg-white p-5 hover:ring-1 hover:ring-navy/30">
            <p className="text-[13px] text-sub">{c.label}</p>
            <p className="tabular mt-1 text-2xl font-extrabold text-navy">{c.value}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-sub">캠페인 현황, 배송·설치 대기, 기간별 통계는 해당 메뉴를 만들면서 추가합니다.</p>
    </div>
  );
}