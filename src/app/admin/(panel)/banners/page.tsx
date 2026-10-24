import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { toKstInput } from "@/lib/admin/datetime";
import { formatDate } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { saveBanner, deleteBanner, savePopup, deletePopup } from "./actions";

type Banner = {
  id: string; eyebrow: string | null; title: string; subtitle: string | null; image_pc: string; image_mobile: string | null;
  button_label: string | null; link_url: string | null; start_at: string | null; end_at: string | null; sort_order: number; is_active: boolean;
};
type Popup = {
  id: string; title: string; body: string | null; image_url: string | null; button_label: string | null; link_url: string | null;
  start_at: string | null; end_at: string | null; sort_order: number; is_active: boolean;
};

const input = "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

function stateOf(x: { is_active: boolean; start_at: string | null; end_at: string | null }, now: number) {
  if (!x.is_active) return { label: "꺼짐", cls: "bg-soft text-sub" };
  if (x.start_at && new Date(x.start_at).getTime() > now) return { label: "예약", cls: "bg-white text-navy ring-1 ring-navy/30" };
  if (x.end_at && new Date(x.end_at).getTime() <= now) return { label: "기간 종료", cls: "bg-soft text-sub" };
  return { label: "노출 중", cls: "bg-navy text-white" };
}

function Period({ start, end }: { start: string | null; end: string | null }) {
  return (
    <>
      <label className="text-[13px] font-semibold">
        시작 (비우면 즉시)
        <input name="start_at" type="datetime-local" defaultValue={start ? toKstInput(start) : ""} className={`${input} mt-1`} />
      </label>
      <label className="text-[13px] font-semibold">
        종료 (비우면 계속)
        <input name="end_at" type="datetime-local" defaultValue={end ? toKstInput(end) : ""} className={`${input} mt-1`} />
      </label>
    </>
  );
}

function BannerFields({ b }: { b?: Banner }) {
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <label className="text-[13px] font-semibold md:col-span-2">
        작은 문구 <span className="font-normal text-sub">(제목 위)</span>
        <input name="eyebrow" defaultValue={b?.eyebrow ?? ""} maxLength={60} placeholder="삼성·LG 가전 공동구매" className={`${input} mt-1`} />
      </label>
      <label className="text-[13px] font-semibold md:col-span-2">
        제목 * <span className="font-normal text-sub">(줄바꿈은 | 로 구분)</span>
        <input name="title" defaultValue={b?.title ?? ""} required maxLength={60} placeholder="프리미엄 가전,|함께 구매하면 달라지는 가격" className={`${input} mt-1`} />
      </label>
      <label className="text-[13px] font-semibold md:col-span-4">
        부제목
        <input name="subtitle" defaultValue={b?.subtitle ?? ""} maxLength={120} className={`${input} mt-1`} />
      </label>
      <div className="md:col-span-2">
        <ImageUploadField name="image_pc" label="PC 이미지" folder="banners" required defaultValue={b?.image_pc ?? ""} hint="권장 1920×720" />
      </div>
      <div className="md:col-span-2">
        <ImageUploadField name="image_mobile" label="모바일 이미지" folder="banners" defaultValue={b?.image_mobile ?? ""} hint="권장 900×1100, 비우면 PC 이미지" />
      </div>
      <label className="text-[13px] font-semibold">
        버튼 문구
        <input name="button_label" defaultValue={b?.button_label ?? ""} maxLength={20} placeholder="자세히 보기" className={`${input} mt-1`} />
      </label>
      <label className="text-[13px] font-semibold">
        링크
        <input name="link_url" defaultValue={b?.link_url ?? ""} placeholder="/campaigns" className={`${input} mt-1`} />
      </label>
      <Period start={b?.start_at ?? null} end={b?.end_at ?? null} />
      <label className="text-[13px] font-semibold">
        순서
        <input name="sort_order" type="number" defaultValue={b?.sort_order ?? 0} className={`${input} mt-1`} />
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
        <input name="is_active" type="checkbox" defaultChecked={b ? b.is_active : true} className="h-4 w-4 accent-[#102a43]" /> 사용
      </label>
    </>
  );
}

function PopupFields({ p }: { p?: Popup }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="text-[13px] font-semibold md:col-span-2">
        제목 *
        <input name="title" defaultValue={p?.title ?? ""} required maxLength={60} className={`${input} mt-1`} />
      </label>
      <div className="md:col-span-2">
        <ImageUploadField name="image_url" label="이미지" folder="popups" defaultValue={p?.image_url ?? ""} hint="권장 800×1000 이하" />
      </div>
      <label className="text-[13px] font-semibold md:col-span-4">
        내용 <span className="font-normal text-sub">(이미지 없이 글만 띄울 때)</span>
        <textarea name="body" defaultValue={p?.body ?? ""} maxLength={1000} className={`${input} mt-1 h-24 py-2`} />
      </label>
      <label className="text-[13px] font-semibold">
        버튼 문구
        <input name="button_label" defaultValue={p?.button_label ?? ""} maxLength={20} placeholder="바로 가기" className={`${input} mt-1`} />
      </label>
      <label className="text-[13px] font-semibold">
        링크
        <input name="link_url" defaultValue={p?.link_url ?? ""} placeholder="/campaigns" className={`${input} mt-1`} />
      </label>
      <Period start={p?.start_at ?? null} end={p?.end_at ?? null} />
      <label className="text-[13px] font-semibold">
        순서
        <input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} className={`${input} mt-1`} />
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
        <input name="is_active" type="checkbox" defaultChecked={p ? p.is_active : true} className="h-4 w-4 accent-[#102a43]" /> 사용
      </label>
    </>
  );
}

export default function AdminBannersPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">배너·팝업</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <BannersView />
      </Suspense>
    </div>
  );
}

async function BannersView() {
  await connection();
  await requireStaff("content");
  const sb = createAdminClient();
  const [{ data: banners }, { data: popups }] = await Promise.all([
    sb.from("banners").select("*").order("sort_order").order("created_at"),
    sb.from("popups").select("*").order("sort_order").order("created_at"),
  ]);
  const now = Date.now();

  return (
    <div className="mt-6 space-y-8">
      {/* ===== 메인 배너 ===== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">메인 배너</h2>
          <p className="text-xs text-sub">순서가 작은 것부터 슬라이드로 넘어갑니다. 노출 중인 배너가 없으면 기본 배너가 나옵니다.</p>
        </div>

        {((banners ?? []) as Banner[]).map((b) => {
          const st = stateOf(b, now);
          return (
            <details key={b.id} className="rounded-xl bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image_pc} alt="" className="h-12 w-28 rounded object-cover" />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                <b className="flex-1 truncate">{b.title.replace(/\|/g, " ")}</b>
                <span className="tabular text-xs text-sub">
                  {b.start_at ? formatDate(b.start_at) : "즉시"} ~ {b.end_at ? formatDate(b.end_at) : "계속"} · 순서 {b.sort_order}
                </span>
              </summary>
              <div className="border-t border-line p-5">
                <ActionForm action={saveBanner} className="grid gap-3 md:grid-cols-4">
                  <BannerFields b={b} />
                  <div className="md:col-span-4"><SubmitButton>저장</SubmitButton></div>
                </ActionForm>
                <ActionForm action={deleteBanner} className="mt-3 text-right">
                  <input type="hidden" name="id" value={b.id} />
                  <button className="text-xs text-sub underline hover:text-coral">이 배너 삭제</button>
                </ActionForm>
              </div>
            </details>
          );
        })}

        <details className="rounded-xl border-2 border-dashed border-line bg-white">
          <summary className="cursor-pointer list-none p-4 font-bold">+ 새 배너 추가</summary>
          <ActionForm action={saveBanner} className="grid gap-3 border-t border-line p-5 md:grid-cols-4">
            <BannerFields />
            <div className="md:col-span-4"><SubmitButton>배너 등록</SubmitButton></div>
          </ActionForm>
        </details>
      </section>

      {/* ===== 팝업 ===== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">팝업</h2>
          <p className="text-xs text-sub">메인 화면에 순서대로 하나씩 뜹니다. 고객이 “오늘 하루 보지 않기”를 누르면 그날은 다시 뜨지 않습니다.</p>
        </div>

        {((popups ?? []) as Popup[]).map((p) => {
          const st = stateOf(p, now);
          return (
            <details key={p.id} className="rounded-xl bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded bg-soft text-xs text-sub">글</span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                <b className="flex-1 truncate">{p.title}</b>
                <span className="tabular text-xs text-sub">
                  {p.start_at ? formatDate(p.start_at) : "즉시"} ~ {p.end_at ? formatDate(p.end_at) : "계속"} · 순서 {p.sort_order}
                </span>
              </summary>
              <div className="border-t border-line p-5">
                <ActionForm action={savePopup} className="grid gap-3 md:grid-cols-4">
                  <PopupFields p={p} />
                  <div className="md:col-span-4"><SubmitButton>저장</SubmitButton></div>
                </ActionForm>
                <ActionForm action={deletePopup} className="mt-3 text-right">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-xs text-sub underline hover:text-coral">이 팝업 삭제</button>
                </ActionForm>
              </div>
            </details>
          );
        })}

        <details className="rounded-xl border-2 border-dashed border-line bg-white">
          <summary className="cursor-pointer list-none p-4 font-bold">+ 새 팝업 추가</summary>
          <ActionForm action={savePopup} className="grid gap-3 border-t border-line p-5 md:grid-cols-4">
            <PopupFields />
            <div className="md:col-span-4"><SubmitButton>팝업 등록</SubmitButton></div>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}