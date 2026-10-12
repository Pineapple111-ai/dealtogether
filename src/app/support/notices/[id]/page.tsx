import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export default function NoticeDetailPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-soft" />}>
        <NoticeView params={params} />
      </Suspense>
    </div>
  );
}

async function NoticeView({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await publicClient()
    .from("notices")
    .select("title, body, created_at")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (!data) notFound();

  return (
    <article>
      <Link href="/support/notices" className="text-sm text-sub hover:text-ink">← 공지사항</Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{data.title}</h1>
      <p className="tabular mt-2 border-b border-line pb-5 text-sm text-sub">{formatDate(data.created_at, false)}</p>
      <div className="mt-6 whitespace-pre-line text-[15px] leading-[1.85] text-ink/85">{data.body}</div>
    </article>
  );
}