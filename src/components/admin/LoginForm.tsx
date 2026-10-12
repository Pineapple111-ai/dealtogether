"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    params.get("denied") ? "관리자 권한이 있는 계정으로 로그인해주세요." : ""
  );

  const next = params.get("next");
  const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const sb = createClient();
    await sb.auth.signOut();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    router.replace(safeNext);
    router.refresh();
  };

  const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-white p-8">
      <p className="text-xl font-extrabold text-navy">딜투게더</p>
      <h1 className="mt-1 text-sm text-sub">관리자 로그인</h1>

      <div className="mt-6 space-y-3">
        <input type="email" required autoComplete="username" placeholder="이메일" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required autoComplete="current-password" placeholder="비밀번호" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral" role="alert">{error}</p>}

      <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
        {loading ? "확인 중..." : "로그인"}
      </button>
    </form>
  );
}