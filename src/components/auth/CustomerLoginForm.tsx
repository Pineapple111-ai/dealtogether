"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "link" ? "인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도해주세요." : ""
  );

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/admin") ? next : "/mypage";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(
        error.message.toLowerCase().includes("not confirmed")
          ? "이메일 인증이 완료되지 않았습니다. 가입 시 받은 메일의 링크를 눌러주세요."
          : "이메일 또는 비밀번호가 올바르지 않습니다."
      );
      setLoading(false);
      return;
    }
    router.replace(safeNext);
    router.refresh();
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-2xl font-extrabold tracking-tight">로그인</h1>

      <div className="mt-8 space-y-3">
        <input type="email" required autoComplete="email" placeholder="이메일" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required autoComplete="current-password" placeholder="비밀번호" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral" role="alert">{error}</p>}

      <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
        {loading ? "확인 중..." : "로그인"}
      </button>

      <div className="mt-5 flex justify-center gap-4 text-sm text-sub">
        <Link href="/signup" className="font-semibold text-navy">회원가입</Link>
        <span className="text-line">|</span>
        <Link href="/forgot-password">비밀번호 찾기</Link>
        <span className="text-line">|</span>
        <Link href="/order-lookup">비회원 주문조회</Link>
      </div>
    </form>
  );
}