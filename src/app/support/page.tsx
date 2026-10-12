import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { publicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "고객센터" };

const LINKS = [
  { href: "/support/faq", t: "자주 묻는 질문" },
  { href: "/support/notices", t: "공지사항" },
  { href: "/support/inquiry", t: "1:1 문의" },
  { href: "/guide", t: "공동구매 이용방법" },
  { href: "/support/delivery", t: "배송·설치 안내" },
  { href: "/policy/refund", t: "취소·환불 안내" },
  { href: "/order-lookup", t: "비회원 주문조회" },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">고객센터</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-soft" />}>
        <SupportView />
      </Suspense>
    </div>
  );
}

async function SupportView() {
  const [{ data: cs }, { data: notices }, { data: faqs }] = await Promise.all([
    createAdminClient().from("site_settings").select("cs_phone, cs_email, cs_hours").eq("id", 1).single(),
    publicClient().from("notices").select("id, title, is_pinned, created_at").eq("is_published", true)
      .order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    publicClient().from("faqs").select("id, question").eq("is_published", true).order("sort_order").limit(5),
  ]);

  return (
    <div className="mt-8 space-y-8">
      <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="rounded-xl bg-navy p-6 text-white">
          <p className="text-sm text-white/60">고객센터</p>
          {cs?.cs_phone ? (
            <a href={`tel:${cs.cs_phone}`} className="tabular mt-1 block text-2xl font-extrabold">{cs.cs_phone}</a>
          ) : (
            <p className="mt-1 text-lg font-bold">1:1 문의를 이용해주세요</p>
          )}
          {cs?.cs_hours && <p className="mt-2 text-sm text-white/70">{cs.cs_hours}</p>}
          {cs?.cs_email && <p className="mt-1 text-sm text-white/70">{cs.cs_email}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center rounded-xl border border-line p-4 text-sm font-semibold hover:border-navy/40">
              {l.t}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">공지사항</h2>
            <Link href="/support/notices" className="text-sm text-sub">전체보기</Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {(notices ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-sub">등록된 공지가 없습니다.</li>}
            {(notices ?? []).map((n) => (
              <li key={n.id}>
                <Link href={`/support/notices/${n.id}`} className="flex justify-between gap-3 px-5 py-3.5 text-sm hover:bg-soft">
                  <span className="truncate">{n.is_pinned && <b className="mr-1 text-coral">[중요]</b>}{n.title}</span>
                  <span className="tabular shrink-0 text-sub">{formatDate(n.created_at, false)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">자주 묻는 질문</h2>
            <Link href="/support/faq" className="text-sm text-sub">전체보기</Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {(faqs ?? []).map((f) => (
              <li key={f.id}>
                <Link href={`/support/faq#${f.id}`} className="block truncate px-5 py-3.5 text-sm hover:bg-soft">Q. {f.question}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}