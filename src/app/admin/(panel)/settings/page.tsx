import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { updatePaymentSettings, updateBrandPaymentUrl, updateBusinessSettings } from "./actions";

const input = "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">설정</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <SettingsView />
      </Suspense>
    </div>
  );
}

async function SettingsView() {
  await connection();
  await requireStaff("settings");
  const sb = createAdminClient();
  const [{ data: s }, { data: brands }] = await Promise.all([
    sb.from("site_settings").select("*").eq("id", 1).single(),
    sb.from("brands").select("id, name, payment_url").order("sort_order"),
  ]);
  if (!s) return <p className="mt-6 text-sm text-coral">설정을 불러오지 못했습니다.</p>;

  return (
    <div className="mt-6 space-y-6">
      {/* 외부 결제 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="font-bold">외부 안전결제</h2>
        <p className="mb-4 mt-1 text-xs text-sub">
          결제 링크 우선순위: 캠페인 링크 → 브랜드 링크 → 공통 링크. 해당하는 링크가 하나도 없으면 주문이 차단됩니다.
        </p>
        <ActionForm action={updatePaymentSettings} className="grid gap-4 md:grid-cols-2">
          <label className="text-[13px] font-semibold md:col-span-2">
            공통 결제 링크
            <input name="default_payment_url" defaultValue={s.default_payment_url ?? ""} className={`${input} mt-1`} placeholder="https://" />
          </label>
          <label className="text-[13px] font-semibold">
            결제 서비스명 (고객에게 표시)
            <input name="payment_provider_name" defaultValue={s.payment_provider_name ?? ""} maxLength={50} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            결제 대기 예약시간 (시간)
            <input name="reservation_hours" type="number" min={1} max={168} defaultValue={s.reservation_hours} className={`${input} mt-1`} />
            <span className="mt-1 block text-xs font-normal text-sub">이 시간 동안 재고를 잡아두고, 지나면 주문이 만료됩니다.</span>
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            승인 도메인 (한 줄에 하나, 비우면 https만 검사)
            <textarea name="allowed_payment_domains" defaultValue={(s.allowed_payment_domains ?? []).join("\n")} className={`${input} mt-1 h-20 py-2`} placeholder="pay.example.co.kr" />
            <span className="mt-1 block text-xs font-normal text-sub">하위 도메인도 허용됩니다. 예: example.co.kr 등록 시 pay.example.co.kr 허용</span>
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            결제 안내 문구
            <textarea name="payment_notice" defaultValue={s.payment_notice} maxLength={500} className={`${input} mt-1 h-20 py-2`} />
            <span className="mt-1 block text-xs font-normal text-sub">
              구매자 보호·결제대금 예치 등은 실제 결제 업체가 제공하는 내용만 안내하세요.
            </span>
          </label>
          <div><SubmitButton>저장</SubmitButton></div>
        </ActionForm>
      </section>

      {/* 브랜드별 결제 링크 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-4 font-bold">브랜드별 결제 링크</h2>
        <div className="space-y-3">
          {(brands ?? []).map((b) => (
            <ActionForm key={b.id} action={updateBrandPaymentUrl} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={b.id} />
              <span className="w-24 text-sm font-semibold">{b.name}</span>
              <input name="payment_url" defaultValue={b.payment_url ?? ""} placeholder="비우면 공통 링크 사용" className={`${input} max-w-xl flex-1`} />
              <SubmitButton>저장</SubmitButton>
            </ActionForm>
          ))}
        </div>
      </section>

      {/* 사업자 정보 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="font-bold">사업자 정보 · 고객센터</h2>
        <p className="mb-4 mt-1 text-xs text-sub">사이트 하단에 표시됩니다. 입력하지 않은 항목은 표시되지 않습니다.</p>
        <ActionForm action={updateBusinessSettings} className="grid gap-4 md:grid-cols-3">
          <label className="text-[13px] font-semibold">
            상호
            <input name="site_name" defaultValue={s.site_name} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            대표자명
            <input name="ceo_name" defaultValue={s.ceo_name ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            사업자등록번호
            <input name="business_number" defaultValue={s.business_number ?? ""} placeholder="000-00-00000" className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            통신판매업 신고번호
            <input name="ecommerce_number" defaultValue={s.ecommerce_number ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold md:col-span-2">
            사업장 주소
            <input name="business_address" defaultValue={s.business_address ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            고객센터 전화
            <input name="cs_phone" defaultValue={s.cs_phone ?? ""} placeholder="1588-0000" className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            고객센터 이메일
            <input name="cs_email" type="email" defaultValue={s.cs_email ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="text-[13px] font-semibold">
            운영시간
            <input name="cs_hours" defaultValue={s.cs_hours ?? ""} placeholder="평일 10:00~18:00 (점심 12~13시)" className={`${input} mt-1`} />
          </label>
          <div><SubmitButton>저장</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}