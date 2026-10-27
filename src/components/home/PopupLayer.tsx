"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HomePopup } from "@/lib/queries/banners";
import Image from "next/image";
import { canOptimize } from "@/lib/images";

const todayKst = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const keyOf = (id: string) => `dt_popup_hide:${id}`;

export default function PopupLayer({ popups }: { popups: HomePopup[] }) {
  const [queue, setQueue] = useState<HomePopup[] | null>(null);

  // "오늘 하루 보지 않기"한 팝업 제외
  useEffect(() => {
    const today = todayKst();
    setQueue(
      popups.filter((p) => {
        try {
          return localStorage.getItem(keyOf(p.id)) !== today;
        } catch {
          return true;
        }
      })
    );
  }, [popups]);

  const current = queue?.[0];
  const close = () => setQueue((q) => (q ? q.slice(1) : q));
  const hideToday = () => {
    if (current) {
      try {
        localStorage.setItem(keyOf(current.id), todayKst());
      } catch {
        /* 저장 불가 환경 */
      }
    }
    close();
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setQueue((q) => (q ? q.slice(1) : q));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  const image = current.image_url && (
    <Image
      src={current.image_url}
      alt={current.title}
      width={800}
      height={1000}
      sizes="384px"
      className="block h-auto max-h-[60vh] w-full object-cover"
      unoptimized={!canOptimize(current.image_url)}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
      onClick={close}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {image && (current.link_url ? <Link href={current.link_url} onClick={close}>{image}</Link> : image)}

        <div className={current.image_url && !current.body && !current.button_label ? "sr-only" : "p-5"}>
          <h2 id="popup-title" className="text-lg font-bold">{current.title}</h2>
          {current.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/80">{current.body}</p>}
          {current.link_url && current.button_label && (
            <Link
              href={current.link_url}
              onClick={close}
              className="mt-4 block rounded-lg bg-navy py-3 text-center text-sm font-bold text-white hover:bg-navy-700"
            >
              {current.button_label}
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-line pb-[env(safe-area-inset-bottom)] text-sm">
          <button type="button" onClick={hideToday} className="py-3.5 text-sub hover:text-ink">오늘 하루 보지 않기</button>
          <button type="button" onClick={close} className="border-l border-line py-3.5 font-bold">닫기</button>
        </div>
      </div>
    </div>
  );
}