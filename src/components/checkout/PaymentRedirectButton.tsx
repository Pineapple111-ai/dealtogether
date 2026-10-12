"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

export default function PaymentRedirectButton({ orderNumber, token }: { orderNumber: string; token: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const go = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderNumber}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "결제 페이지로 이동할 수 없습니다.");
        setLoading(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError("결제 페이지에 연결하지 못했습니다. 주문은 결제 대기 상태로 유지됩니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy text-base font-bold text-white transition-colors hover:bg-navy-700 disabled:bg-sub"
      >
        {loading ? "이동 중..." : "외부 안전결제 페이지로 이동"}
        {!loading && <ExternalLink size={18} />}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-coral/10 p-3 text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}