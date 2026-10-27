import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getStoreProductsByIds, type StoreProduct } from "@/lib/queries/store";
import { STORE_CATEGORY_LABEL } from "@/lib/store";
import { won } from "@/lib/format";
import CompareTable from "@/components/compare/CompareTable";
import RemoveCompareButton from "@/components/compare/RemoveCompareButton";

export const metadata: Metadata = { title: "상품 비교", robots: { index: false } };

type Props = { searchParams: Promise<{ ids?: string }> };

export default function CompareStorePage(props: Props) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">상품 비교</h1>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-soft" />}>
        <View {...props} />
      </Suspense>
    </div>
  );
}

const price = (p: StoreProduct) => {
  const prices = p.skus.map((s) => s.salePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? won(min) : `${won(min)} ~ ${won(max)}`;
};

async function View({ searchParams }: Props) {
  const { ids = "" } = await searchParams;
  const wanted = [...new Set(ids.split(",").map((s) => s.trim()))].slice(0, 3);
  const found = await getStoreProductsByIds(wanted);
  const list = wanted.map((id) => found.find((p) => p.id === id)).filter((p): p is StoreProduct => !!p);

  if (list.length === 0) {
    return (
      <div className="mt-8 rounded-xl bg-soft px-6 py-16 text-center text-sm text-sub">
        비교할 상품이 없습니다. 가전 쇼핑에서 <b>+ 비교</b>를 눌러 담아주세요.
        <Link href="/store" className="mt-4 block font-semibold text-navy underline">가전 쇼핑 가기</Link>
      </div>
    );
  }

  const keys = list.map((p) => p.id);
  const minPrice = Math.min(...list.map((p) => p.minPrice));
  const maxRate = Math.max(...list.map((p) => p.maxDiscountRate));
  const best = (on: boolean, text: React.ReactNode) => (on ? <b className="text-navy">{text}</b> : text);

  return (
    <div className="mt-6 space-y-4">
      <CompareTable
        columns={list.map((p) => ({
          key: p.id,
          image: p.thumbnail,
          imageRatio: "1/1" as const,
          brand: p.brand.name,
          brandColor: p.brand.theme_color ?? "#102a43",
          name: p.name,
          href: `/store/${p.id}`,
          remove: <RemoveCompareButton kind="store" id={p.id} ids={keys} basePath="/compare/store" />,
        }))}
        rows={[
          { label: "분류 · 종류", cells: list.map((p) => `${STORE_CATEGORY_LABEL[p.category] ?? "-"} · ${p.productType}`) },
          { label: "모델", cells: list.map((p) => p.models.map((m) => m.code).join(", ")) },
          { label: "판매가", cells: list.map((p) => best(p.minPrice === minPrice, <span className="text-base font-extrabold">{price(p)}</span>)) },
          { label: "정상가", cells: list.map((p) => (p.minListPrice > p.minPrice ? <span key="l" className="text-sub line-through">{won(p.minListPrice)}</span> : "-")) },
          { label: "할인율", cells: list.map((p) => (p.maxDiscountRate > 0 ? best(p.maxDiscountRate === maxRate, <span className="font-bold text-coral">최대 {p.maxDiscountRate}%</span>) : "-")) },
          {
            label: "선택 항목",
            cells: list.map((p) =>
              p.attributeKeys.length === 0 ? (
                "-"
              ) : (
                <ul key="attrs" className="space-y-1">
                  {p.attributeKeys.map((k) => (
                    <li key={k}>
                      <b>{k}</b>{" "}
                      <span className="text-sub">{[...new Set(p.skus.map((s) => s.attributes[k]).filter(Boolean))].join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )
            ),
          },
          {
            label: "설치 옵션",
            cells: list.map((p) =>
              p.addonGroups.length === 0 ? (
                "-"
              ) : (
                <ul key="addons" className="space-y-1.5">
                  {p.addonGroups.map((g) => (
                    <li key={g.id}>
                      <b>{g.name}</b>
                      <span className="block text-xs text-sub">
                        {g.values.map((v) => `${v.label} ${v.isQuoteRequired ? "(현장 견적)" : v.price > 0 ? `+${won(v.price)}` : "무료"}`).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ),
          },
          { label: "세트 할인", cells: list.map((p) => (p.bundleEligible ? <span key="b" className="font-semibold text-navy">대상</span> : "대상 아님")) },
          { label: "구매 가능", cells: list.map((p) => (p.inStock ? "구매 가능" : <span key="s" className="font-semibold text-coral">품절</span>)) },
          { label: "요약", cells: list.map((p) => p.summary ?? "-") },
        ]}
      />
      <p className="text-xs text-sub">세트 할인 대상 상품을 함께 장바구니에 담으면 세트 할인이 적용됩니다.</p>
    </div>
  );
}