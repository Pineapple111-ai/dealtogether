import { useEffect, useState } from "react";

export type CompareKind = "campaign" | "store";
export const COMPARE_MAX = 3;

const KEY = (k: CompareKind) => `dt_compare_${k}`;
const EVENT = "dt-compare-change";

export function readCompare(kind: CompareKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY(kind)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function write(kind: CompareKind, ids: string[]) {
  try {
    localStorage.setItem(KEY(kind), JSON.stringify(ids.slice(0, COMPARE_MAX)));
  } catch {
    /* 저장 불가 환경 */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function toggleCompare(kind: CompareKind, id: string): "added" | "removed" | "full" {
  const ids = readCompare(kind);
  if (ids.includes(id)) {
    write(kind, ids.filter((x) => x !== id));
    return "removed";
  }
  if (ids.length >= COMPARE_MAX) return "full";
  write(kind, [...ids, id]);
  return "added";
}

export function removeCompare(kind: CompareKind, id: string) {
  write(kind, readCompare(kind).filter((x) => x !== id));
}

export function clearCompare(kind: CompareKind) {
  write(kind, []);
}

export function useCompare(kind: CompareKind) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    const sync = () => setIds(readCompare(kind));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [kind]);
  return ids;
}