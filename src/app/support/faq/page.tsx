import { Suspense } from "react";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { publicClient } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "자주 묻는 질문" };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">자주 묻는 질문</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-soft" />}>
        <FaqList />
      </Suspense>
    </div>
  );
}

async function FaqList() {
  const { data } = await publicClient()
    .from("faqs")
    .select("id, category, question, answer")
    .eq("is_published", true)
    .order("sort_order");

  const groups = new Map<string, NonNullable<typeof data>>();
  for (const f of data ?? []) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);

  if (groups.size === 0) return <p className="mt-8 text-sm text-sub">등록된 질문이 없습니다.</p>;

  return (
    <div className="mt-8 space-y-8">
      {[...groups.entries()].map(([cat, items]) => (
        <section key={cat}>
          <h2 className="mb-3 text-sm font-bold text-sub">{cat}</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {items.map((f) => (
              <details key={f.id} id={f.id} className="group scroll-mt-28">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold">
                  <span>Q. {f.question}</span>
                  <ChevronDown size={18} className="shrink-0 text-sub transition-transform group-open:rotate-180" />
                </summary>
                <p className="whitespace-pre-line bg-soft px-5 py-4 text-[15px] leading-relaxed text-ink/85">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}