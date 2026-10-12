"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelOrderButton({ orderNumber, token }: { orderNumber: string; token: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cancel = async () => {
    if (!window.confirm("이 주문을 취소할까요?\n취소 후에는 되돌릴 수 없습니다.")) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderNumber}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(json.message);
  };

  return (
    <div className="text-center">
      <button type="button" onClick={cancel} disabled={loading} className="text-sm text-sub underline underline-offset-4 hover:text-coral disabled:opacity-50">
        {loading ? "취소 중..." : "주문 취소"}
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}