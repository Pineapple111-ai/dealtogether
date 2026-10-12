"use client";

import { useState } from "react";
import Link from "next/link";
import PhoneInput from "@/components/form/PhoneInput";

const CATEGORIES = ["상품", "주문·결제", "배송·설치", "취소·환불", "기타"];
const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

export default function InquiryForm({ campaignSlug, campaignName }: { campaignSlug?: string; campaignName?: string }) {
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    category: campaignSlug ? "상품" : "",
    orderNumber: "",
    content: "",
    agreePrivacy: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { member: boolean }>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, campaignSlug: campaignSlug ?? "" }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) setDone({ member: json.member });
    else setError(json.message);
  };

  if (done) {
    return (
      <div className="rounded-xl bg-soft p-8 text-center">
        <h2 className="text-xl font-bold">문의가 접수되었습니다</h2>
        <p className="mt-2 text-sm text-sub">
          {done.member ? "답변은 마이페이지에서 확인할 수 있습니다." : "남겨주신 연락처로 안내드리겠습니다."}
        </p>
        <Link href={done.member ? "/mypage" : "/support"} className="mt-6 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
          {done.member ? "마이페이지" : "고객센터"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {campaignName && (
        <p className="rounded-lg bg-soft px-4 py-3 text-sm">
          관심 패키지: <b>{campaignName}</b>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">이름 <span className="text-coral">*</span></span>
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={30} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">휴대폰 번호 <span className="text-coral">*</span></span>
          <PhoneInput className={input} value={f.phone} onChange={(v) => set("phone", v)} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">이메일</span>
          <input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">문의 유형 <span className="text-coral">*</span></span>
          <select className={input} value={f.category} onChange={(e) => set("category", e.target.value)} required>
            <option value="" disabled>선택</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">주문번호 (주문 관련 문의 시)</span>
        <input
          className={`${input} tabular uppercase`}
          value={f.orderNumber}
          onChange={(e) => set("orderNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 18))}
          placeholder="DT-20261012-000001"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">문의 내용 <span className="text-coral">*</span></span>
        <textarea className={`${input} h-40 py-3`} value={f.content} onChange={(e) => set("content", e.target.value)} maxLength={3000} required />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#102a43]" checked={f.agreePrivacy} onChange={(e) => set("agreePrivacy", e.target.checked)} />
        <span>
          <b>[필수]</b> 개인정보 수집·이용 동의
          <span className="block text-xs text-sub">수집 항목: 이름, 휴대폰 번호, 이메일, 문의 내용 / 목적: 문의 답변</span>
        </span>
      </label>
      {error && <p className="text-sm font-semibold text-coral" role="alert">{error}</p>}
      <button type="submit" disabled={loading} className="h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
        {loading ? "접수 중..." : "문의하기"}
      </button>
    </form>
  );
}