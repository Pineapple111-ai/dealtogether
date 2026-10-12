"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export const SORTS = [
  { key: "recommended", label: "추천순" },
  { key: "popular", label: "인기순" },
  { key: "discount", label: "할인율순" },
  { key: "price_asc", label: "가격 낮은순" },
  { key: "price_desc", label: "가격 높은순" },
  { key: "closing", label: "마감 임박순" },
  { key: "newest", label: "최신순" },
];

export default function ListingControls({ showSearch = true }: { showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {showSearch && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: q.trim().slice(0, 50) });
          }}
          className="relative flex-1 sm:max-w-sm"
          role="search"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="패키지명, 제품명, 모델명 검색"
            className="h-11 w-full rounded-lg border border-line bg-white pl-3.5 pr-11 text-sm outline-none focus:border-navy"
            aria-label="검색어"
          />
          <button type="submit" aria-label="검색" className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-sub hover:text-navy">
            <Search size={18} />
          </button>
        </form>
      )}
      <select
        value={params.get("sort") ?? "recommended"}
        onChange={(e) => push({ sort: e.target.value === "recommended" ? "" : e.target.value })}
        className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-navy sm:ml-auto"
        aria-label="정렬"
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}