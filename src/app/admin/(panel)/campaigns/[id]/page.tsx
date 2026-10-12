import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { toCampaignView, STATUS_LABEL, type CampaignRow, type CampaignStats } from "@/lib/campaign";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { won, formatDate } from "@/lib/format";
import { toKstInput } from "@/lib/admin/datetime";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { updateCampaign, setCampaignState, duplicateCampaign } from "../actions";

type Params = { params: Promise<{ id: string }> };
type Raw = CampaignRow & {
  per_user_limit: number; payment_url: string | null; is_visible: boolean; closing_soon_hours: number | null;
};

const CONFIRMED = ["paid", "preparing", "shipping", "delivered", "installation_scheduled", "completed"];
const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminCampaignDetail({ params }: Params) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
      <CampaignDetail params={params} />
    </Suspense>
  );
}

function Fields({ c, prefix = "" }: { c: Raw; prefix?: string }) {
  return (
    <>
      <label className="text-[13px] font-semibold md:col-span-2">
        캠페인명
        <input name="name" required defaultValue={prefix ? `${c.name} (다음 회차)` : c.name} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold md:col-span-2">
        주소(slug)
        <input name="slug" required defaultValue={prefix ? `${c.slug}-${prefix}` : c.slug} className={`${input} mt-1 block w-full lowercase`} />
      </label>
      <label className="text-[13px] font-semibold">
        모집 시작 (KST)
        <input name="start_at" type="datetime-local" required defaultValue={prefix ? "" : toKstInput(c.start_at)} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        모집 종료 (KST)
        <input name="end_at" type="datetime-local" required defaultValue={prefix ? "" : toKstInput(c.end_at)} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        공동구매가 (원)
        <input name="campaign_price" type="number" min={0} step={1000} defaultValue={c.campaign_price} className={`${input} tabular mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        목표 인원
        <input name="target_participants" type="number" min={1} defaultValue={c.target_participants} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        판매 가능 수량
        <input name="max_quantity" type="number" min={1} defaultValue={c.max_quantity} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        1인 구매 한도
        <input name="per_user_limit" type="number" min={1} defaultValue={c.per_user_limit} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        마감 임박 기준 (시간)
        <input name="closing_soon_hours" type="number" min={1} defaultValue={c.closing_soon_hours ?? ""} placeholder="48" className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-[13px] font-semibold">
        캠페인 결제 링크
        <input name="payment_url" defaultValue={prefix ? "" : c.payment_url ?? ""} placeholder="비우면 브랜드 → 공통" className={`${input} mt-1 block w-full`} />
      </label>
      <label className="flex items-center gap-2 text-[13px] font-semibold">
        <input name="is_visible" type="checkbox" defaultChecked={prefix ? true : c.is_visible} className="h-4 w-4 accent-[#102a43]" /> 고객 화면 노출
      </label>
    </>
  );
}

async function CampaignDetail({ params }: Params) {
  await connection();
  await requireStaff("campaigns");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const sb = createAdminClient();
  const [{ data }, { data: stats }, { data: orders }] = await Promise.all([
    sb
      .from("campaigns")
      .select(`*, package:packages!inner(id, name, slug, summary, list_price, thumbnail_url, brand:brands!inner(name, slug, theme_color), category:categories!inner(name, slug))`)
      .eq("id", id)
      .maybeSingle(),
    sb.from("campaign_stats").select("*").eq("campaign_id", id).maybeSingle(),
    sb
      .from("orders")
      .select("order_number, buyer_name, quantity, grand_total, status, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();

  const raw = data as unknown as Raw;
  const c = toCampaignView(raw, (stats as CampaignStats) ?? undefined, Date.now());
  const all = orders ?? [];
  const confirmed = all.filter((o) => CONFIRMED.includes(o.status));
  const revenue = confirmed.reduce((s, o) => s + o.grand_total, 0);
  const cancelled = all.filter((o) => o.status === "cancelled").length;
  const refunded = all.filter((o) => o.status === "refunded").length;
  const nextSuffix = Date.now().toString(36).slice(-4);

  const summary: [string, string][] = [
    ["상태", STATUS_LABEL[c.status]],
    ["확정 참여", `${c.participants}명 / 목표 ${c.targetParticipants}명 (${c.progress}%)`],
    ["판매 수량", `${c.sold}세트 / ${c.maxQuantity}세트 · 잔여 ${c.remaining}`],
    ["확정 매출", won(revenue)],
    ["목표 달성", c.participants >= c.targetParticipants ? "달성" : "미달성"],
    ["취소 / 환불", `${cancelled}건 / ${refunded}건`],
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/campaigns" className="text-sm text-sub hover:text-ink">← 캠페인 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold">{c.name}</h1>
        <p className="text-sm text-sub">
          <Link href={`/admin/packages/${c.package.id}`} className="underline">{c.package.brand.name} · {c.package.name}</Link>
          <Link href={`/campaigns/${c.slug}`} target="_blank" className="ml-3 text-navy underline">고객 화면 보기</Link>
        </p>
      </div>

      {/* 현황 */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white p-4">
            <p className="text-[13px] text-sub">{k}</p>
            <p className="tabular mt-1 font-bold">{v}</p>
          </div>
        ))}
      </section>

      {/* 운영 */}
      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-5">
        <h2 className="mr-3 font-bold">운영</h2>
        {raw.manual_state === null ? (
          <ActionForm action={setCampaignState}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="state" value="closed" />
            <SubmitButton className="bg-white !text-navy ring-1 ring-navy hover:!bg-navy/5">조기 마감</SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={setCampaignState}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="state" value="open" />
            <SubmitButton>모집 재개</SubmitButton>
          </ActionForm>
        )}
        {raw.manual_state !== "cancelled" && (
          <ActionForm action={setCampaignState}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="state" value="cancelled" />
            <SubmitButton className="bg-white !text-coral ring-1 ring-coral hover:!bg-coral/5">캠페인 취소</SubmitButton>
          </ActionForm>
        )}
        <p className="basis-full text-xs text-sub">
          조기 마감·취소해도 기존 주문은 자동 취소되지 않습니다. 결제 대기 주문은 주문 관리에서 개별 처리하세요.
        </p>
      </section>

      {/* 수정 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">캠페인 설정</h2>
        <ActionForm action={updateCampaign} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="id" value={c.id} />
          <Fields c={raw} />
          <div className="md:col-span-4"><SubmitButton>저장</SubmitButton></div>
        </ActionForm>
        <p className="mt-3 text-xs text-sub">가격을 바꾸면 이후 주문부터 적용됩니다. 이미 접수된 주문 금액은 그대로 유지됩니다.</p>
      </section>

      {/* 복제 */}
      <section className="rounded-xl border-2 border-dashed border-line bg-white p-5">
        <h2 className="mb-1 font-bold">이 캠페인으로 다음 공동구매 만들기</h2>
        <p className="mb-4 text-xs text-sub">같은 패키지로 새 회차를 엽니다. 주문·참여 기록은 복제되지 않고 0부터 시작합니다.</p>
        <ActionForm action={duplicateCampaign} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="source_id" value={c.id} />
          <Fields c={raw} prefix={nextSuffix} />
          <label className="flex items-center gap-2 text-[13px]">
            <input name="keep_payment_url" type="checkbox" defaultChecked className="h-4 w-4 accent-[#102a43]" /> 결제 링크 유지
          </label>
          <label className="flex items-center gap-2 text-[13px] md:col-span-2">
            <input name="copy_package" type="checkbox" className="h-4 w-4 accent-[#102a43]" />
            패키지도 복사본으로 만들기 (구성·옵션·이미지·설명을 이번 회차만 따로 바꿀 때)
          </label>
          <div className="md:col-span-4"><SubmitButton>새 캠페인 만들기</SubmitButton></div>
        </ActionForm>
      </section>

      {/* 주문 이력 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">주문 내역 ({all.length}건)</h2>
        {all.length === 0 ? (
          <p className="text-sm text-sub">주문이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line text-left text-[13px] text-sub">
                <tr>
                  <th className="py-2 pr-3 font-semibold">주문번호</th>
                  <th className="py-2 pr-3 font-semibold">주문일시</th>
                  <th className="py-2 pr-3 font-semibold">주문자</th>
                  <th className="py-2 pr-3 text-right font-semibold">수량</th>
                  <th className="py-2 pr-3 text-right font-semibold">금액</th>
                  <th className="py-2 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {all.map((o) => (
                  <tr key={o.order_number}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/orders/${o.order_number}`} className="font-semibold text-navy hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="py-2 pr-3 text-sub">{formatDate(o.created_at)}</td>
                    <td className="py-2 pr-3">{o.buyer_name}</td>
                    <td className="py-2 pr-3 text-right">{o.quantity}</td>
                    <td className="py-2 pr-3 text-right">{won(o.grand_total)}</td>
                    <td className="py-2">{ORDER_STATUS_LABEL[o.status] ?? o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}