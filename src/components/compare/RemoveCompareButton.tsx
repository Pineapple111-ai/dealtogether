"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { removeCompare, type CompareKind } from "@/lib/compare";

export default function RemoveCompareButton({ kind, id, ids, basePath }: { kind: CompareKind; id: string; ids: string[]; basePath: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        removeCompare(kind, id);
        const rest = ids.filter((x) => x !== id);
        router.replace(rest.length ? `${basePath}?ids=${rest.map(encodeURIComponent).join(",")}` : basePath);
      }}
      className="flex items-center gap-1 text-xs font-semibold text-sub hover:text-coral"
    >
      <X size={13} /> 빼기
    </button>
  );
}