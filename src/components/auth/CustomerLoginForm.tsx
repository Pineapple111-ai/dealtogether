"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PhoneInput from "@/components/form/PhoneInput";
import { createClient } from "@/lib/supabase/client";
import { phoneToAuthEmail } from "@/lib/auth/phone-login";
import { PHONE_REGEX } from "@/lib/phone";

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function CustomerLoginForm() {
  const params = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/admin") ? next : "/mypage";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!PHONE_REGEX.test(phone)) {
      setError("휴대폰 번호를 010-0000-0000 형식으로 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: phoneToAuthEmail(phone),
        password,
      });
      if (error) {
        setError("휴대폰 번호 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }
      window.location.assign(safeNext);
    } catch {
      setError("로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-2xl font-extrabold tracking-tight">로그인</h1>

      <div className="mt-8 space-y-3">
        <PhoneInput className={input} value={phone} onChange={setPhone} required />
        <input type="password" required autoComplete="current-password" placeholder="비밀번호" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral" role="alert">{error}</p>}

      <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
        {loading ? "확인 중..." : "로그인"}
      </button>

      <div className="mt-5 flex justify-center gap-4 text-sm text-sub">
        <Link href="/signup" className="font-semibold text-navy">회원가입</Link>
        <span className="text-line">|</span>
        <Link href="/order-lookup">비회원 주문조회</Link>
      </div>
      <p className="mt-4 text-center text-xs text-sub">
        비밀번호를 잊으셨나요? <Link href="/support/inquiry" className="underline">고객센터</Link>로 문의하시면 임시 비밀번호를 안내해드립니다.
      </p>
    </form>
  );
}