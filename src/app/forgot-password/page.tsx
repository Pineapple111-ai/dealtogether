"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    // 가입 여부와 관계없이 같은 안내 (계정 존재 여부 노출 방지)
    if (error && error.status === 429) {
      setError("요청이 많습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16 md:py-24">
      {sent ? (
        <div className="text-center">
          <h1 className="text-2xl font-extrabold">메일을 확인해주세요</h1>
          <p className="mt-3 text-sm leading-relaxed text-sub">
            가입된 이메일이라면 <b className="text-ink">{email}</b>로
            <br />
            비밀번호 재설정 링크를 보냈습니다.
          </p>
          <Link href="/login" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
            로그인으로 이동
          </Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h1 className="text-2xl font-extrabold tracking-tight">비밀번호 찾기</h1>
          <p className="mt-2 text-sm text-sub">가입한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="이메일"
            className={`${input} mt-8`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="mt-3 text-sm font-semibold text-coral" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
            {loading ? "발송 중..." : "재설정 링크 받기"}
          </button>
        </form>
      )}
    </div>
  );
}