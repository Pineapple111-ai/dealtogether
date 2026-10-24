import Link from "next/link";
import Image from "next/image";
import { IMG } from "@/lib/images";

export default function StaticHero() {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <Image src={IMG.hero} alt="" fill priority sizes="100vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/80 to-navy/40 md:from-navy/90 md:via-navy/55 md:to-transparent" />
      <div className="relative mx-auto flex min-h-[480px] max-w-site flex-col justify-center px-4 py-16 md:min-h-[560px] md:px-6">
        <p className="text-sm font-semibold text-white/70">삼성·LG 가전 공동구매 · 골라담기 세트 할인</p>
        <h1 className="mt-4 max-w-2xl text-[34px] font-extrabold leading-[1.2] tracking-[-0.03em] md:text-[56px]">
          프리미엄 가전,
          <br />
          함께 구매하면 달라지는 가격
        </h1>
        <p className="mt-5 max-w-lg text-base text-white/80 md:text-lg">삼성·LG 인기 가전을 특별한 공동구매 패키지로 만나보세요.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/campaigns" className="inline-flex rounded-lg bg-coral px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-coral-600">
            공동구매 상품 보기
          </Link>
          <Link href="/store" className="inline-flex rounded-lg border border-white/50 bg-navy/30 px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-white/10">
            가전 쇼핑하기
          </Link>
        </div>
      </div>
    </section>
  );
}