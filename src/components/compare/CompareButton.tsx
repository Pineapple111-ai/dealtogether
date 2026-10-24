"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toggleCompare, useCompare, COMPARE_MAX, type CompareKind } from "@/lib/compare";

export default function CompareButton({ kind, id, className = "" }: { kind: CompareKind; id: string; className?: string }) {
  const ids = useCompare(kind);
  const on = !!ids?.includes(id);
  const [msg, setMsg] = useState("");

  return (
    <div className={className}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "비교함에서 빼기" : "비교함에 담기"}
        onClick={() => {
          if (toggleCompare(kind, id) === "full") {
            setMsg(`최대 ${COMPARE_MAX}개까지 비교할 수 있어요`);
            setTimeout(() => setMsg(""), 2200);
          }
        }}
        className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold shadow-sm transition-colors ${
          on ? "bg-navy text-white" : "bg-white/95 text-ink hover:bg-white"
        }`}
      >
        {on ? <Check size={13} /> : <Plus size={13} />} 비교
      </button>
      {msg && (
        <span className="absolute right-0 top-10 z-10 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white">
          {msg}
        </span>
      )}
    </div>
  );
}