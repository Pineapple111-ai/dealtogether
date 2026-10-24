import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다", robots: { index: false } };

const LINKS = [
  { href: "/campaigns", label: "공동구매 보기" },
  { href: "/store", label: "가전 쇼핑" },
  { href: "/support", label: "고객센터" },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center md:py-32">
      <p className="tabular text-5xl font-extrabold text-navy/20">404</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-sm leading-relaxed text-sub">
        주소가 바뀌었거나 판매가 종료된 상품일 수 있습니다.
        <br />
        아래에서 원하는 메뉴로 이동해주세요.
      </p>
      <div className="mx-auto mt-8 w-full max-w-sm">
        <Link href="/" className="block rounded-lg bg-navy py-3.5 text-sm font-bold text-white hover:bg-navy-700">
          홈으로 가기
        </Link>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-line py-3 text-[13px] font-semibold text-ink hover:border-navy/40 hover:text-navy"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}