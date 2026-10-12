"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import PhoneInput from "@/components/form/PhoneInput";
import { phoneSchema } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해주세요.").max(30),
    email: z.string().trim().email("이메일 형식을 확인해주세요."),
    phone: phoneSchema,
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Za-z]/, "비밀번호에 영문을 포함해주세요.")
      .regex(/[0-9]/, "비밀번호에 숫자를 포함해주세요."),
    passwordConfirm: z.string(),
    agreeTerms: z.literal(true, { message: "이용약관에 동의해주세요." }),
    agreePrivacy: z.literal(true, { message: "개인정보 수집·이용에 동의해주세요." }),
    marketing: z.boolean(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function SignupForm() {
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
    agreeTerms: false,
    agreePrivacy: false,
    marketing: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const allRequired = f.agreeTerms && f.agreePrivacy;
  const toggleAll = (v: boolean) => setF((s) => ({ ...s, agreeTerms: v, agreePrivacy: v, marketing: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const parsed = schema.safeParse(f);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        if (!map[k]) map[k] = i.message;
      }
      setErrors(map);
      return;
    }
    setErrors({});
    setLoading(true);

    const { error } = await createClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/mypage`,
        data: { name: parsed.data.name, phone: parsed.data.phone, marketing_agreed: parsed.data.marketing },
      },
    });
    setLoading(false);

    if (error) {
      setServerError(
        error.message.includes("registered")
          ? "이미 가입된 이메일입니다. 로그인해주세요."
          : "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">인증 메일을 보냈습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          <b className="text-ink">{f.email}</b>로 보낸 메일의 링크를 눌러 가입을 완료해주세요.
          <br />
          메일이 보이지 않으면 스팸함을 확인해주세요.
        </p>
        <Link href="/login" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
          로그인으로 이동
        </Link>
      </div>
    );
  }

  const Err = ({ k }: { k: string }) =>
    errors[k] ? <span className="mt-1 block text-xs font-semibold text-coral">{errors[k]}</span> : null;

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-2xl font-extrabold tracking-tight">회원가입</h1>
      <p className="mt-1 text-sm text-sub">가입하면 참여한 공동구매와 주문을 한곳에서 확인할 수 있어요.</p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">이름</span>
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={30} />
          <Err k="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">이메일</span>
          <input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          <Err k="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">휴대폰 번호</span>
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
          <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={allRequired && f.marketing} onChange={(e) => toggleAll(e.target.checked)} />
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
        {loading ? "처리 중..." : "가입하기"}
      </button>
      <p className="mt-4 text-center text-sm text-sub">
        이미 회원이신가요? <Link href="/login" className="font-semibold text-navy">로그인</Link>
      </p>
    </form>
  );
}