"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCompare, clearCompare, COMPARE_MAX, type CompareKind } from "@/lib/compare";

// 하단 구매 바가 있는 화면과 관리자·비교 화면에서는 숨김
const HIDE = [/^\/admin/, /^\/compare/, /^\/campaigns\/[^/]+$/, /^\/store\/[^/]+$/, /^\/cart/, /^\/checkout/, /^\/orders/];

function Group({ kind, label, ids, base }: { kind: CompareKind; label: string; ids: string[]; base: string }) {
  const ready = ids.length >= 2;
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-soft py-1 pl-3 pr-1">
      <span className="tabular text-sm">
        {label} <b className="text-navy">{ids.length}</b>/{COMPARE_MAX}
      </span>
      {ready ? (
        <Link href={`${base}?ids=${ids.map(encodeURIComponent).join(",")}`} className="rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-700">
          비교하기
        </Link>
      ) : (
        <span className="px-2 text-xs text-sub">1개 더 담아주세요</span>
      )}
      <button type="button" onClick={() => clearCompare(kind)} aria-label={`${label} 비교함 비우기`} className="grid h-7 w-7 place-items-center rounded-md text-sub hover:bg-white hover:text-ink">
        <X size={14} />
      </button>
    </div>
  );
}

export default function CompareBar() {
  const pathname = usePathname();
  const campaigns = useCompare("campaign") ?? [];
  const store = useCompare("store") ?? [];

  if (HIDE.some((r) => r.test(pathname))) return null;
  if (campaigns.length === 0 && store.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-site flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <span className="mr-1 text-sm font-bold">비교함</span>
        {campaigns.length > 0 && <Group kind="campaign" label="공동구매" ids={campaigns} base="/compare/campaigns" />}
        {store.length > 0 && <Group kind="store" label="쇼핑 상품" ids={store} base="/compare/store" />}
      </div>
    </div>
  );
}