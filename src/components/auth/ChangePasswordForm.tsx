"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RULE, PASSWORD_MESSAGE } from "@/lib/auth/phone-login";

const input = "h-11 w-full rounded-lg border border-line px-3.5 text-sm outline-none focus:border-navy";

export default function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!PASSWORD_RULE.test(pw)) return setMsg({ ok: false, text: PASSWORD_MESSAGE });
    if (pw !== pw2) return setMsg({ ok: false, text: "비밀번호가 일치하지 않습니다." });
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      setMsg({
        ok: false,
        text: error.message.toLowerCase().includes("different")
          ? "기존 비밀번호와 다른 비밀번호를 입력해주세요."
          : "비밀번호 변경에 실패했습니다. 다시 로그인 후 시도해주세요.",
      });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <input type="password" autoComplete="new-password" placeholder="새 비밀번호 (영문·숫자 포함 8자 이상)" className={input} value={pw} onChange={(e) => setPw(e.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" className={input} value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-navy" : "text-coral"}`}>{msg.text}</p>}
      <button type="submit" disabled={loading} className="h-11 rounded-lg bg-navy px-5 text-sm font-bold text-white disabled:bg-sub">
        {loading ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}