"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";

// DB change_order_status와 동일한 전이 규칙 (결제 완료는 결제 확인으로만)
const NEXT: Record<string, string[]> = {
  pending_payment: ["payment_verification", "cancelled", "expired"],
  payment_verification: ["pending_payment", "cancelled", "expired"],
  paid: ["preparing", "cancelled", "refunded"],
  preparing: ["shipping", "cancelled", "refunded"],
  shipping: ["delivered", "refunded"],
  delivered: ["installation_scheduled", "completed", "refunded"],
  installation_scheduled: ["completed", "refunded"],
  completed: ["refunded"],
  expired: ["cancelled"],
};

const PAID = ["paid", "preparing", "shipping", "delivered", "installation_scheduled", "completed"];

export default function OrderStatusActions({
  orderNumber,
  status,
  canEdit,
}: {
  orderNumber: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const options = NEXT[status] ?? [];
  if (!canEdit) return <p className="text-sm text-sub">상태 변경 권한이 없습니다.</p>;
  if (options.length === 0) return <p className="text-sm text-sub">변경 가능한 상태가 없습니다.</p>;

  const isCancel = target === "cancelled" || target === "refunded";
  const showRestock = isCancel && PAID.includes(status);

  const submit = async () => {
    if (!target) return;
    if (!window.confirm(`주문 상태를 '${ORDER_STATUS_LABEL[target]}'(으)로 변경할까요?`)) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/admin/orders/${orderNumber}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target, reason, restock }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      setTarget("");
      setReason("");
      router.refresh();
    } else setMsg(json.message);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTarget(s)}
            aria-pressed={target === s}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              target === s ? "border-navy bg-navy text-white" : "border-line bg-white"
            } ${s === "cancelled" || s === "refunded" ? "text-coral" : ""} ${target === s && (s === "cancelled" || s === "refunded") ? "!text-white !bg-coral !border-coral" : ""}`}
          >
            {ORDER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {target && (
        <>
          <textarea
            className="h-20 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            placeholder={isCancel ? "취소·환불 사유 (필수)" : "변경 사유 (선택)"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          {showRestock && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
              재고 복구 (반품 상품이 판매 불가하면 해제)
            </label>
          )}
          {PAID.includes(status) && isCancel && (
            <p className="text-xs text-sub">결제 완료 주문을 취소·환불하면 공동구매 참여 집계에서 자동 제외됩니다.</p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="h-11 w-full rounded-lg bg-navy text-sm font-bold text-white disabled:bg-sub"
          >
            {loading ? "처리 중..." : "상태 변경"}
          </button>
        </>
      )}
      {msg && <p className="text-sm font-semibold text-coral" role="alert">{msg}</p>}
    </div>
  );
}