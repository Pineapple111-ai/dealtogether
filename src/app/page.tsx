import Link from "next/link";
import { Suspense } from "react";
import LiveSections from "@/components/home/LiveSections";
import StoreSection from "@/components/home/StoreSection";
import HeroSection from "@/components/home/HeroSection";
import StaticHero from "@/components/home/StaticHero";
import HomePopups from "@/components/home/HomePopups";

const STEPS = [
  { title: "패키지 선택", desc: "진행 중인 공동구매에서 원하는 가전 패키지를 고릅니다." },
  { title: "구성품·옵션 선택", desc: "모델, 크기, 색상, 설치 방식을 허용된 범위에서 선택합니다." },
  { title: "주문서 작성 후 안전결제", desc: "주문번호를 받고 외부 안전결제 페이지에서 결제합니다." },
  { title: "결제 확인 후 배송·설치", desc: "결제가 확인되면 배송과 설치 일정을 안내합니다." },
];

const SUPPORT = [
  { title: "공동구매 진행 절차", href: "/guide" },
  { title: "외부 안전결제 이용 안내", href: "/guide#payment" },
  { title: "배송 및 설치 절차", href: "/support/delivery" },
  { title: "교환·환불 안내", href: "/policy/refund" },
  { title: "1:1 문의", href: "/support/inquiry" },
];

function LiveSkeleton() {
  return (
    <div className="mx-auto max-w-site px-4 py-16 md:px-6">
      <div className="h-24 animate-pulse rounded-xl bg-soft" />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-soft" />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* 메인 배너 (관리자 배너가 없으면 기본 배너) */}
      <Suspense fallback={<StaticHero />}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<LiveSkeleton />}>
        <LiveSections />
      </Suspense>

      <Suspense fallback={<div className="mx-auto mt-20 h-80 max-w-site animate-pulse rounded-xl bg-soft" />}>
        <StoreSection />
      </Suspense>

      {/* 이용방법 */}
      <section className="mx-auto max-w-site px-4 pt-20 md:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight md:text-[28px]">공동구매 이용방법</h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-white p-6">
              <span className="tabular text-sm font-bold text-coral">STEP {i + 1}</span>
              <p className="mt-2 text-lg font-bold">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-sub">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 신뢰·고객지원 */}
      <section className="mx-auto max-w-site px-4 pt-20 md:px-6">
        <div className="rounded-xl bg-soft p-6 md:p-10">
          <h2 className="text-xl font-extrabold md:text-2xl">구매 전에 확인해주세요</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sub">
            결제는 외부 안전결제 서비스에서 진행되며, 결제 확인 후 주문이 확정됩니다.
            결제 페이지로 이동한 것만으로는 주문이 확정되지 않습니다.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {SUPPORT.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-navy/40">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 팝업 */}
      <Suspense fallback={null}>
        <HomePopups />
      </Suspense>
    </>
  );
}