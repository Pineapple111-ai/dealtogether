import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import {
  updatePolicy, createNotice, updateNotice, deleteNotice, createFaq, updateFaq, deleteFaq,
} from "./actions";

const TABS = [
  { key: "policies", label: "약관·정책" },
  { key: "notices", label: "공지사항" },
  { key: "faqs", label: "FAQ" },
];

const input = "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";
const area = "w-full rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-navy";

type SP = Promise<{ tab?: string }>;

export default function AdminContentPage({ searchParams }: { searchParams: SP }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">콘텐츠</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <ContentView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContentView({ searchParams }: { searchParams: SP }) {
  await connection();
  await requireStaff("content");
  const { tab = "policies" } = await searchParams;
  const sb = createAdminClient();

  return (
    <div className="mt-5">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/content?tab=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-navy text-white" : "bg-white"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {tab === "policies" && <Policies sb={sb} />}
        {tab === "notices" && <Notices sb={sb} />}
        {tab === "faqs" && <Faqs sb={sb} />}
      </div>
    </div>
  );
}

type SB = ReturnType<typeof createAdminClient>;

async function Policies({ sb }: { sb: SB }) {
  const { data } = await sb.from("policies").select("key, title, body, updated_at").order("key");
  return (
    <div className="space-y-5">
      <p className="text-xs text-sub">약관·정책은 법적 효력이 있는 문서입니다. 게시 전 사업 내용에 맞는지 검토하세요. 줄바꿈은 그대로 표시됩니다.</p>
      {(data ?? []).map((p) => (
        <section key={p.key} className="rounded-xl bg-white p-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="font-bold">{p.title}</h2>
            <span className="tabular text-xs text-sub">
              {p.body.trim() ? `최종 수정 ${formatDate(p.updated_at)}` : "미등록 (고객 화면에 '준비 중' 표시)"}
            </span>
            <Link href={`/policy/${p.key}`} target="_blank" className="text-xs text-navy underline">고객 화면 보기</Link>
          </div>
          <ActionForm action={updatePolicy} className="space-y-3">
            <input type="hidden" name="key" value={p.key} />
            <textarea name="body" defaultValue={p.body} className={`${area} h-72`} />
            <SubmitButton>저장</SubmitButton>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}

async function Notices({ sb }: { sb: SB }) {
  const { data } = await sb
    .from("notices")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-3 font-bold">새 공지</h2>
        <ActionForm action={createNotice} className="space-y-3">
          <input name="title" required maxLength={150} placeholder="제목" className={input} />
          <textarea name="body" required placeholder="내용" className={`${area} h-40`} />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input name="is_pinned" type="checkbox" className="h-4 w-4 accent-[#102a43]" /> 상단 고정 (중요)</label>
            <label className="flex items-center gap-1.5"><input name="is_published" type="checkbox" defaultChecked className="h-4 w-4 accent-[#102a43]" /> 게시</label>
            <SubmitButton>등록</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-2">
        {(data ?? []).length === 0 && <p className="rounded-xl bg-white p-8 text-center text-sm text-sub">등록된 공지가 없습니다.</p>}
        {(data ?? []).map((n) => (
          <details key={n.id} className="group rounded-xl bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm">
              {n.is_pinned && <span className="font-bold text-coral">[중요]</span>}
              <span className="flex-1 truncate font-semibold">{n.title}</span>
              {!n.is_published && <span className="text-xs text-sub">숨김</span>}
              <span className="tabular text-xs text-sub">{formatDate(n.created_at, false)}</span>
            </summary>
            <div className="border-t border-line p-4">
              <ActionForm action={updateNotice} className="space-y-3">
                <input type="hidden" name="id" value={n.id} />
                <input name="title" defaultValue={n.title} required className={input} />
                <textarea name="body" defaultValue={n.body} required className={`${area} h-40`} />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input name="is_pinned" type="checkbox" defaultChecked={n.is_pinned} className="h-4 w-4 accent-[#102a43]" /> 상단 고정</label>
                  <label className="flex items-center gap-1.5"><input name="is_published" type="checkbox" defaultChecked={n.is_published} className="h-4 w-4 accent-[#102a43]" /> 게시</label>
                  <SubmitButton>저장</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={deleteNotice} className="mt-3 text-right">
                <input type="hidden" name="id" value={n.id} />
                <button className="text-xs text-sub underline hover:text-coral">삭제</button>
              </ActionForm>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

async function Faqs({ sb }: { sb: SB }) {
  const { data } = await sb.from("faqs").select("*").order("sort_order");
  const categories = [...new Set((data ?? []).map((f) => f.category))];

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-3 font-bold">새 FAQ</h2>
        <ActionForm action={createFaq} className="grid gap-3 md:grid-cols-4">
          <input name="category" required list="faq-cats" placeholder="분류 (예: 결제)" className={input} />
          <datalist id="faq-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <input name="question" required maxLength={200} placeholder="질문" className={`${input} md:col-span-3`} />
          <textarea name="answer" required placeholder="답변" className={`${area} h-28 md:col-span-4`} />
          <input name="sort_order" type="number" defaultValue={(data?.length ?? 0) + 1} className={input} aria-label="순서" />
          <label className="flex items-center gap-1.5 text-sm"><input name="is_published" type="checkbox" defaultChecked className="h-4 w-4 accent-[#102a43]" /> 게시</label>
          <div><SubmitButton>등록</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="space-y-2">
        {(data ?? []).map((f) => (
          <details key={f.id} className="rounded-xl bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm">
              <span className="tabular w-6 text-sub">{f.sort_order}</span>
              <span className="rounded bg-soft px-2 py-0.5 text-xs">{f.category}</span>
              <span className="flex-1 truncate font-semibold">{f.question}</span>
              {!f.is_published && <span className="text-xs text-sub">숨김</span>}
            </summary>
            <div className="border-t border-line p-4">
              <ActionForm action={updateFaq} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="id" value={f.id} />
                <input name="category" defaultValue={f.category} required className={input} />
                <input name="question" defaultValue={f.question} required className={`${input} md:col-span-3`} />
                <textarea name="answer" defaultValue={f.answer} required className={`${area} h-28 md:col-span-4`} />
                <input name="sort_order" type="number" defaultValue={f.sort_order} className={input} aria-label="순서" />
                <label className="flex items-center gap-1.5 text-sm"><input name="is_published" type="checkbox" defaultChecked={f.is_published} className="h-4 w-4 accent-[#102a43]" /> 게시</label>
                <div><SubmitButton>저장</SubmitButton></div>
              </ActionForm>
              <ActionForm action={deleteFaq} className="mt-3 text-right">
                <input type="hidden" name="id" value={f.id} />
                <button className="text-xs text-sub underline hover:text-coral">삭제</button>
              </ActionForm>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}