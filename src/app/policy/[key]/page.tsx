import { Suspense } from "react";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/format";

const KEYS = ["terms", "privacy", "refund"];
type Props = { params: Promise<{ key: string }> };

export default function PolicyPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-soft" />}>
        <PolicyView params={params} />
      </Suspense>
    </div>
  );
}

async function PolicyView({ params }: Props) {
  const { key } = await params;
  if (!KEYS.includes(key)) notFound();

  const { data } = await publicClient().from("policies").select("title, body, updated_at").eq("key", key).single();
  if (!data) notFound();

  return (
    <article>
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{data.title}</h1>
      {data.body.trim() ? (
        <>
          <p className="tabular mt-2 text-sm text-sub">최종 수정 {formatDate(data.updated_at, false)}</p>
          <div className="mt-8 whitespace-pre-line text-[15px] leading-[1.85] text-ink/85">{data.body}</div>
        </>
      ) : (
        <p className="mt-8 rounded-xl bg-soft p-8 text-center text-sm text-sub">
          내용을 준비하고 있습니다. 문의 사항은 고객센터로 연락해주세요.
        </p>
      )}
    </article>
  );
}