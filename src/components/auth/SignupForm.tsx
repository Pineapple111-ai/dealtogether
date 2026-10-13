"use client";

import { useState } from "react";
import Link from "next/link";
import PhoneInput from "@/components/form/PhoneInput";
import { createClient } from "@/lib/supabase/client";
import { phoneToAuthEmail, PASSWORD_RULE, PASSWORD_MESSAGE } from "@/lib/auth/phone-login";
import { PHONE_REGEX } from "@/lib/phone";

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function SignupForm() {
  const [f, setF] = useState({
    name: "",
    phone: "",
    password: "",
    passwordConfirm: "",
    agreeTerms: false,
    agreePrivacy: false,
    marketing: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const allChecked = f.agreeTerms && f.agreePrivacy && f.marketing;
  const toggleAll = (v: boolean) => setF((s) => ({ ...s, agreeTerms: v, agreePrivacy: v, marketing: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "이름을 입력해주세요.";
    if (!PHONE_REGEX.test(f.phone)) e.phone = "휴대폰 번호를 010-0000-0000 형식으로 입력해주세요.";
    if (!PASSWORD_RULE.test(f.password)) e.password = PASSWORD_MESSAGE;
    if (f.password !== f.passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!f.agreeTerms) e.agreeTerms = "이용약관에 동의해주세요.";
    if (!f.agreePrivacy) e.agreePrivacy = "개인정보 수집·이용에 동의해주세요.";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name,
          phone: f.phone,
          password: f.password,
          agreeTerms: f.agreeTerms,
          agreePrivacy: f.agreePrivacy,
          marketing: f.marketing,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(json.message);
        setLoading(false);
        return;
      }

      // 가입 즉시 로그인
      const { error } = await createClient().auth.signInWithPassword({
        email: phoneToAuthEmail(f.phone),
        password: f.password,
      });
      if (error) {
        window.location.assign("/login");
        return;
      }
      window.location.assign("/mypage");
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  const Err = ({ k }: { k: string }) =>
    errors[k] ? <span className="mt-1 block text-xs font-semibold text-coral">{errors[k]}</span> : null;

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-2xl font-extrabold tracking-tight">회원가입</h1>
      <p className="mt-1 text-sm text-sub">휴대폰 번호로 간편하게 가입하세요.</p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">이름</span>
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={30} />
          <Err k="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">휴대폰 번호 (로그인 ID)</span>
          <PhoneInput className={input} value={f.phone} onChange={(v) => set("phone", v)} />
          <Err k="phone" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">비밀번호</span>
          <input type="password" className={input} value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" placeholder="영문·숫자 포함 8자 이상" />
          <Err k="password" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">비밀번호 확인</span>
          <input type="password" className={input} value={f.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} autoComplete="new-password" />
          <Err k="passwordConfirm" />
        </label>
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-line p-4 text-sm">
        <label className="flex items-center gap-2 border-b border-line pb-3 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
          전체 동의
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={f.agreeTerms} onChange={(e) => set("agreeTerms", e.target.checked)} />
          <span><b>[필수]</b> 이용약관 동의</span>
          <Link href="/policy/terms" target="_blank" className="ml-auto text-xs text-sub underline">보기</Link>
        </label>
        <Err k="agreeTerms" />
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={f.agreePrivacy} onChange={(e) => set("agreePrivacy", e.target.checked)} />
          <span><b>[필수]</b> 개인정보 수집·이용 동의</span>
          <Link href="/policy/privacy" target="_blank" className="ml-auto text-xs text-sub underline">보기</Link>
        </label>
        <Err k="agreePrivacy" />
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={f.marketing} onChange={(e) => set("marketing", e.target.checked)} />
          <span>[선택] 공동구매 소식·혜택 수신 동의</span>
        </label>
      </div>

      {serverError && <p className="mt-4 text-sm font-semibold text-coral" role="alert">{serverError}</p>}

      <button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
        {loading ? "가입 중..." : "가입하기"}
      </button>
      <p className="mt-4 text-center text-sm text-sub">
        이미 회원이신가요? <Link href="/login" className="font-semibold text-navy">로그인</Link>
      </p>
    </form>
  );
}