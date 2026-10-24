"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center md:py-32">
      <h1 className="text-2xl font-extrabold tracking-tight">일시적인 오류가 발생했습니다</h1>
      <p className="mt-3 text-sm leading-relaxed text-sub">
        잠시 후 다시 시도해주세요. 문제가 계속되면 고객센터로 문의해주세요.
      </p>
      {error.digest && <p className="tabular mt-2 text-xs text-sub">오류 코드: {error.digest}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white hover:bg-navy-700"
        >
          다시 시도
        </button>
        <Link href="/" className="rounded-lg border border-line px-6 py-3 text-sm font-bold hover:border-navy/40">
          홈으로
        </Link>
      </div>
    </div>
  );
}