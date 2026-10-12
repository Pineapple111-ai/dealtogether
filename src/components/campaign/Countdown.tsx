"use client";

import { useEffect, useState } from "react";

type Props = {
  endAt: string;
  serverNow: number; // 서버 시간 기준 보정
  variant?: "inline" | "boxes";
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ endAt, serverNow, variant = "inline" }: Props) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const offset = serverNow - Date.now();
    const end = new Date(endAt).getTime();
    const tick = () => setLeft(Math.max(end - (Date.now() + offset), 0));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endAt, serverNow]);

  if (left === null) {
    return <span className="tabular text-sub">--:--:--</span>;
  }
  if (left === 0) {
    return <span className="font-semibold text-sub">모집 마감</span>;
  }

  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (variant === "boxes") {
    const parts = [
      [pad(d), "일"],
      [pad(h), "시간"],
      [pad(m), "분"],
      [pad(sec), "초"],
    ];
    return (
      <div className="flex items-end gap-1.5" aria-live="off">
        {parts.map(([v, u]) => (
          <span key={u} className="flex items-baseline gap-0.5">
            <span className="tabular rounded-md bg-navy px-2 py-1 text-xl font-bold text-white">{v}</span>
            <span className="text-xs text-sub">{u}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <span className="tabular">
      {d > 0 && `${d}일 `}
      {pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}