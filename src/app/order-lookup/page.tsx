"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneInput from "@/components/form/PhoneInput";

export default function OrderLookupPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, phone }),
    });
    const json = await res.json();
    if (res.ok) {
      router.push(`/orders/${json.orderNumber}/pay?t=${json.token}`);
      return;
    }
    setError(json.message);
    setLoading(false);
  };

  const input = "h-12 w-full rounded-lg border border-line px-3.5 text-[15px] outline-none focus:border-navy";

  return (
    <div className="mx-auto max-w-md px-4 py-16 md:py-24">
      <h1 className="text-2xl font-extrabold tracking-tight">비회원 주문조회</h1>
      <p className="mt-2 text-sm text-sub">주문 시 받은 주문번호와 주문자 휴대폰 번호를 입력해주세요.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">주문번호</span>
          <input
            className={`${input} tabular uppercase`}
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 18))}
            placeholder="DT-20261012-000001"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">주문자 휴대폰 번호</span>
          <PhoneInput className={input} value={phone} onChange={setPhone} required />
        </label>

        {error && <p className="text-sm font-semibold text-coral" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub">
          {loading ? "조회 중..." : "주문 조회"}
        </button>
      </form>
    </div>
  );
}