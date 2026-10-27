import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";

type BizInfo = {
  site_name: string;
  ceo_name: string | null;
  business_number: string | null;
  ecommerce_number: string | null;
  business_address: string | null;
  cs_phone: string | null;
  cs_email: string | null;
  cs_hours: string | null;
  payment_provider_name: string | null;
};

async function getBizInfo(): Promise<BizInfo | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("site_name, ceo_name, business_number, ecommerce_number, business_address, cs_phone, cs_email, cs_hours, payment_provider_name")
      .eq("id", 1)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function Footer() {
  const info = await getBizInfo();

  // 관리자가 입력한 항목만 표시 (미입력 항목은 임의 생성하지 않음)
  const rows = [
    ["상호", info?.site_name],
    ["대표자", info?.ceo_name],
    ["사업자등록번호", info?.business_number],
    ["통신판매업 신고번호", info?.ecommerce_number],
    ["주소", info?.business_address],
    ["이메일", info?.cs_email],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <footer className="mt-24 border-t border-line bg-soft pb-24 md:pb-0">
      <div className="mx-auto max-w-site px-4 py-12 md:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xl">
<Image src="/images/logo.png" alt="딜투게더" width={334} height={80} className="h-8 w-auto" />
            <p className="mt-1 text-sm text-sub">좋은 가전, 더 좋은 가격. 함께하는 딜투게더.</p>

            <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px]" aria-label="약관 및 정책">
              <Link href="/policy/terms" className="font-semibold">이용약관</Link>
              <Link href="/policy/privacy" className="font-bold text-navy">개인정보처리방침</Link>
              <Link href="/policy/refund" className="font-semibold">교환·반품·환불 정책</Link>
              <Link href="/support/notices" className="text-sub">공지사항</Link>
              <Link href="/support/faq" className="text-sub">자주 묻는 질문</Link>
            </nav>

            {rows.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-sub">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt>{k}</dt>
                    <dd className="text-ink/70">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="md:text-right">
            <p className="text-[13px] text-sub">고객센터</p>
            {info?.cs_phone ? (
              <a href={`tel:${info.cs_phone}`} className="tabular mt-1 block text-2xl font-bold text-ink">
                {info.cs_phone}
              </a>
            ) : (
              <p className="mt-1 text-sm text-sub">1:1 문의를 이용해주세요</p>
            )}
            {info?.cs_hours && <p className="mt-1 text-[13px] text-sub">{info.cs_hours}</p>}
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-[12px] leading-relaxed text-sub">
          <p>
            딜투게더는 공동구매 주문을 접수하며, 결제는 외부 안전결제 서비스
            {info?.payment_provider_name ? `(${info.payment_provider_name})` : ""}에서 진행됩니다.
            딜투게더는 결제대금을 직접 보관하거나 정산하지 않으며, 결제 관련 보호 범위는 해당 결제 서비스의 정책을 따릅니다.
          </p>
          <p className="mt-3">© Deal Together. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
