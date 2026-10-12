import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { toCampaignView, STATUS_LABEL, type CampaignRow, type CampaignStats } from "@/lib/campaign";
import { won, formatDate } from "@/lib/format";
import { toKstInput } from "@/lib/admin/datetime";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { createCampaign } from "./actions";

const CONFIRMED = ["paid", "preparing", "shipping", "delivered", "installation_scheduled", "completed"];
const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminCampaignsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">공동구매 캠페인</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <CampaignsView />
      </Suspense>
    </div>
  );
}

async function CampaignsView() {
  await connection();
  await requireStaff("campaigns");
  const sb = createAdminClient();

  const [{ data: rows }, { data: stats }, { data: orders }, { data: packages }] = await Promise.all([
    sb
      .from("campaigns")
      .select(`id, name, slug, start_at, end_at, target_participants, max_quantity, campaign_price, closing_soon_hours, manual_state, is_visible,
        package:packages!inner(id, name, slug, summary, list_price, thumbnail_url, brand:brands!inner(name, slug, theme_color), category:categories!inner(name, slug))`)
      .order("start_at", { ascending: false }),
    sb.from("campaign_stats").select("*"),
    sb.from("orders").select("campaign_id, status, grand_total"),
    sb.from("packages").select("id, name, brand:brands(name)").eq("status", "active").order("created_at", { ascending: false }),
  ]);

  const statsMap = new Map(((stats ?? []) as CampaignStats[]).map((s) => [s.campaign_id, s]));
  const revenue = new Map<string, number>();
  for (const o of orders ?? []) {
    if (CONFIRMED.includes(o.status)) revenue.set(o.campaign_id, (revenue.get(o.campaign_id) ?? 0) + o.grand_total);
  }
  const now = Date.now();
  const list = ((rows ?? []) as unknown as (CampaignRow & { is_visible: boolean })[]).map((r) => ({
    ...toCampaignView(r, statsMap.get(r.id), now),
    isVisible: r.is_visible,
  }));
  const pkgOpts = (packages ?? []) as unknown as { id: string; name: string; brand: { name: string } }[];

  const today = toKstInput(new Date().toISOString()).slice(0, 10);

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">새 캠페인</h2>
        <ActionForm action={createCampaign} className="grid gap-3 md:grid-cols-4">
          <label className="text-[13px] font-semibold md:col-span-2">
            패키지
            <select name="package_id" required defaultValue="" className={`${input} mt-1 block w-full`}>
              <option value="" disabled>선택</option>
              {pkgOpts.map((p) => <option key={p.id} value={p.id}>[{p.brand?.name}] {p.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-semibold">
            캠페인명
            <input name="name" required className={`${input} mt-1 block w-full`} placeholder="2026년 11월 LG 거실 공동구매" />
          </label>
          <label className="text-[13px] font-semibold">
            주소(slug)
            <input name="slug" required className={`${input} mt-1 block w-full lowercase`} placeholder="lg-living-2611" />
          </label>
          <label className="text-[13px] font-semibold">
            모집 시작 (KST)
            <input name="start_at" type="datetime-local" required defaultValue={`${today}T10:00`} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            모집 종료 (KST)
            <input name="end_at" type="datetime-local" required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            공동구매가 (원)
            <input name="campaign_price" type="number" min={0} step={1000} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            목표 인원
            <input name="target_participants" type="number" min={1} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            판매 가능 수량 (세트)
            <input name="max_quantity" type="number" min={1} required className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            1인 구매 한도
            <input name="per_user_limit" type="number" min={1} defaultValue={1} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            마감 임박 기준 (시간, 비우면 48)
            <input name="closing_soon_hours" type="number" min={1} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-[13px] font-semibold">
            캠페인 결제 링크 (선택)
            <input name="payment_url" className={`${input} mt-1 block w-full`} placeholder="비우면 브랜드 → 공통 링크" />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input name="is_visible" type="checkbox" defaultChecked className="h-4 w-4 accent-[#102a43]" /> 고객 화면 노출
          </label>
          <div className="md:col-span-3"><SubmitButton>캠페인 만들기</SubmitButton></div>
        </ActionForm>
      </section>

      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-line text-left text-[13px] text-sub">
            <tr>
              <th className="px-4 py-3 font-semibold">캠페인</th>
              <th className="px-4 py-3 font-semibold">기간</th>
              <th className="px-4 py-3 font-semibold">상태</th>
              <th className="px-4 py-3 text-right font-semibold">참여 / 목표</th>
              <th className="px-4 py-3 text-right font-semibold">판매 / 수량</th>
              <th className="px-4 py-3 text-right font-semibold">공동구매가</th>
              <th className="px-4 py-3 text-right font-semibold">확정 매출</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {list.length === 0 && <tr><td colSpan={7} className="px-4 py-14 text-center text-sub">캠페인이 없습니다.</td></tr>}
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-soft/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/campaigns/${c.id}`} className="font-bold text-navy hover:underline">{c.name}</Link>
                  <span className="block text-xs text-sub">{c.package.brand.name} · {c.package.name}</span>
                </td>
                <td className="px-4 py-3 text-[13px] text-sub">
                  {formatDate(c.startAt)}<br />~ {formatDate(c.endAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={c.status === "closing_soon" ? "font-bold text-coral" : c.isPurchasable ? "font-bold text-navy" : "text-sub"}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  {!c.isVisible && <span className="block text-xs text-sub">숨김</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.participants} / {c.targetParticipants}
                  {c.participants >= c.targetParticipants && <span className="block text-xs font-bold text-navy">목표 달성</span>}
                </td>
                <td className="px-4 py-3 text-right">{c.sold} / {c.maxQuantity}</td>
                <td className="px-4 py-3 text-right">{won(c.campaignPrice)}</td>
                <td className="px-4 py-3 text-right font-semibold">{won(revenue.get(c.id) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}