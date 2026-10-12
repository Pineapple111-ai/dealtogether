"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 재설정 링크로 들어온 세션이 있는지 확인
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      setError("비밀번호는 영문·숫자를 포함해 8자 이상이어야 합니다.");
      return;
    }
    if (pw !== pw2) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("different")
          ? "기존 비밀번호와 다른 비밀번호를 입력해주세요."
          : "비밀번호 변경에 실패했습니다. 재설정 링크를 다시 요청해주세요."
      );
      return;
    }
    window.alert("비밀번호가 변경되었습니다.");
    router.replace("/mypage");
    router.refresh();
  };

  if (ready === null) return <div className="mx-auto h-64 max-w-sm" />;

  if (!ready) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24 text-center">
        <h1 className="text-xl font-bold">링크가 만료되었습니다</h1>
        <p className="mt-3 text-sm text-sub">비밀번호 재설정 링크를 다시 요청해주세요.</p>
        <Link href="/forgot-password" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
          다시 요청하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 md:py-24">
      <form onSubmit={submit}>
        <h1 className="text-2xl font-extrabold tracking-tight">새 비밀번호 설정</h1>
        <div className="mt-8 space-y-3">
          <input type="password" autoComplete="new-password" placeholder="새 비밀번호 (영문·숫자 포함 8자 이상)" className={input} value={pw} onChange={(e) => setPw(e.target.value)} required />
          <input type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" className={input} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-coral" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}