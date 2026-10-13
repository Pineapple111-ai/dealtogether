export const STORE_CATEGORIES = [
  { key: "video", label: "영상가전", desc: "TV · 사운드바" },
  { key: "kitchen", label: "주방가전", desc: "냉장고 · 식기세척기 · 인덕션" },
  { key: "laundry", label: "세탁가전", desc: "세탁기 · 건조기 · 의류관리기" },
  { key: "air", label: "냉난방·공기", desc: "에어컨 · 공기청정기 · 제습기" },
  { key: "life", label: "생활가전", desc: "청소기 · 로봇청소기" },
] as const;

export type StoreCategoryKey = (typeof STORE_CATEGORIES)[number]["key"];

export const STORE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  STORE_CATEGORIES.map((c) => [c.key, c.label])
);

export function isStoreCategory(v: string): v is StoreCategoryKey {
  return STORE_CATEGORIES.some((c) => c.key === v);
}

export type DiscountRule = {
  id: string;
  name: string;
  rule_type: "count" | "category" | "amount";
  tiers: { min: number; rate: number }[];
};

/** 고객 안내용 문구: "2개 품목 이상 3% · 3개 품목 이상 5%" */
export function describeRule(r: DiscountRule) {
  const unit = (m: number) =>
    r.rule_type === "count"
      ? `${m}개 품목`
      : r.rule_type === "category"
        ? `${m}개 분류`
        : `${(m / 10000).toLocaleString("ko-KR")}만원`;
  return [...r.tiers]
    .sort((a, b) => a.min - b.min)
    .map((t) => `${unit(t.min)} 이상 ${t.rate}%`)
    .join(" · ");
}