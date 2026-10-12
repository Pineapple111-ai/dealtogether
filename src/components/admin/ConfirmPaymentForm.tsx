"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { won } from "@/lib/format";

export default function ConfirmPaymentForm({
  orderNumber,
  expectedAmount,
  defaultProvider,
  canEdit,
}: {
  orderNumber: string;
  expectedAmount: number;
  defaultProvider: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(expectedAmount));
  const [provider, setProvider] = useState(defaultProvider);
  const [txId, setTxId] = useState("");
  const [memo, setMemo] = useState("");
  const [force, setForce] = useState(false);
  const [needForce, setNeedForce] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const mismatch = amountNum !== expectedAmount;

  if (!canEdit) {
    return <p className="text-sm text-sub">결제 확인은 최고 관리자 또는 주문 관리자만 할 수 있습니다.</p>;
  }

  const submit = async () => {
    if (!window.confirm(`${won(amountNum)} 결제를 확인 처리할까요?\n처리 후 공동구매 참여 인원에 반영됩니다.`)) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/admin/orders/${orderNumber}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedAmount: amountNum, providerName: provider, txId, memo, force }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    if (json.code === "AMOUNT_MISMATCH" || json.code === "EXPIRED_NEEDS_REVIEW") setNeedForce(true);
    setMsg(json.message);
  };

  const input = "h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold">
          확인 금액 (원)
          <input
            className={`${input} tabular mt-1 ${mismatch ? "border-coral" : ""}`}
            inputMode="numeric"
            value={amountNum.toLocaleString("ko-KR")}
            onChange={(e) => setAmount(e.target.value)}
          />
          {mismatch && (
            <span className="mt-1 block text-xs font-semibold text-coral">
              주문금액 {won(expectedAmount)}과 {won(Math.abs(amountNum - expectedAmount))} 차이
            </span>
          )}
        </label>
        <label className="block text-[13px] font-semibold">
          결제 서비스명
          <input className={`${input} mt-1`} value={provider} onChange={(e) => setProvider(e.target.value)} maxLength={50} />
        </label>
        <label className="block text-[13px] font-semibold sm:col-span-2">
          외부 거래번호
          <input className={`${input} mt-1`} value={txId} onChange={(e) => setTxId(e.target.value)} maxLength={100} placeholder="결제 업체 관리 화면의 거래번호" />
        </label>
        <label className="block text-[13px] font-semibold sm:col-span-2">
          메모 {force && <span className="text-coral">* 강제 확인 사유 필수</span>}
          <textarea className={`${input} mt-1 h-20 py-2`} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} />
        </label>
      </div>

      {needForce && (
        <label className="flex items-start gap-2 rounded-lg bg-coral/10 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#e5484d]" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span>
            <b className="text-coral">강제 확인</b> — 결제 내역을 직접 확인했으며, 사유를 메모에 기록합니다.
            재고와 캠페인 한도는 다시 검증됩니다.
          </span>
        </label>
      )}

      {msg && <p className="text-sm font-semibold text-coral" role="alert">{msg}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={loading || amountNum <= 0}
        className="h-12 w-full rounded-lg bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub"
      >
        {loading ? "처리 중..." : "결제 확인 처리"}
      </button>
    </div>
  );
}