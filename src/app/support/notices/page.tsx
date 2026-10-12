import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { publicClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "공지사항" };

export default function NoticesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">공지사항</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-soft" />}>
        <NoticeList />
      </Suspense>
    </div>
  );
}

async function NoticeList() {
  const { data } = await publicClient()
    .from("notices")
    .select("id, title, is_pinned, created_at")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <ul className="mt-8 divide-y divide-line border-y border-line">
      {(data ?? []).length === 0 && <li className="py-12 text-center text-sm text-sub">등록된 공지가 없습니다.</li>}
      {(data ?? []).map((n) => (
        <li key={n.id}>
          <Link href={`/support/notices/${n.id}`} className="flex justify-between gap-4 px-2 py-4 hover:bg-soft">
            <span className="truncate font-semibold">{n.is_pinned && <span className="mr-1.5 text-coral">[중요]</span>}{n.title}</span>
            <span className="tabular shrink-0 text-sm text-sub">{formatDate(n.created_at, false)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}