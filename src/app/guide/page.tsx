import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "공동구매 이용안내" };

const STEPS = [
  { t: "패키지 선택", d: "진행 중인 공동구매에서 원하는 가전 패키지를 고릅니다. 각 공동구매는 모집 기간, 목표 인원, 판매 수량이 정해져 있습니다." },
  { t: "구성품·옵션 선택", d: "구성품별로 모델, 크기, 색상, 설치 방식을 선택합니다. 실제 판매 중인 조합만 선택할 수 있고, 옵션에 따라 금액이 바로 계산됩니다." },
  { t: "주문서 작성", d: "주문자, 배송지, 설치 정보를 입력하면 주문번호가 발급됩니다. 이때부터 결제 대기 기한 동안 재고가 예약됩니다." },
  { t: "외부 안전결제", d: "안전결제 페이지로 이동해 결제합니다. 결제 시 주문번호와 결제 예정금액을 확인해주세요." },
  { t: "결제 확인 · 참여 확정", d: "결제가 확인되면 주문이 결제 완료로 바뀌고 공동구매 참여 인원에 반영됩니다." },
  { t: "배송·설치", d: "상품 준비 후 배송·설치 일정을 조율해 안내드립니다." },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">공동구매 이용안내</h1>
      <p className="mt-2 text-sub">딜투게더 공동구매는 이렇게 진행됩니다.</p>

      <ol className="mt-10 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex gap-5 rounded-xl border border-line p-5 md:p-6">
            <span className="tabular grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">{i + 1}</span>
            <div>
              <p className="text-lg font-bold">{s.t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-sub">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <section id="payment" className="mt-14 scroll-mt-28 rounded-xl bg-soft p-6 md:p-8">
        <h2 className="text-xl font-extrabold">외부 안전결제 이용 안내</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/85">
          <li>딜투게더는 주문을 접수하며, 결제는 외부 안전결제 서비스에서 진행됩니다.</li>
          <li>딜투게더는 결제대금을 직접 보관하거나 정산하지 않습니다. 결제 보호 범위와 조건은 해당 결제 서비스의 정책을 따릅니다.</li>
          <li>결제 페이지로 이동한 것만으로는 결제가 완료되지 않습니다. 결제 확인 후 주문 내역에 반영됩니다.</li>
          <li>결제 대기 기한이 지나면 주문이 만료되고 재고 예약이 해제됩니다.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-line p-6 md:p-8">
        <h2 className="text-xl font-extrabold">취소·환불</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
          결제 전 주문은 결제 대기 페이지에서 직접 취소할 수 있습니다. 결제 완료 후 취소·환불은 고객센터로 문의해주세요.
          자세한 기준은 <Link href="/policy/refund" className="font-semibold text-navy underline">교환·반품·환불 정책</Link>을 확인해주세요.
        </p>
      </section>
    </div>
  );
}