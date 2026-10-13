import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreProducts, getActiveDiscountRules } from "@/lib/queries/store";
import { getBrands } from "@/lib/queries/listing";
import { STORE_CATEGORIES, describeRule, isStoreCategory } from "@/lib/store";
import PromoBanner from "@/components/common/PromoBanner";
import { IMG } from "@/lib/images";

export const metadata: Metadata = { title: "가전 쇼핑" };

type SP = Promise<{ category?: string; brand?: string; sort?: string; q?: string }>;

const SORTS = [
  { key: "", label: "추천순" },
  { key: "price_asc", label: "낮은 가격순" },
  { key: "price_desc", label: "높은 가격순" },
  { key: "discount", label: "할인율순" },
  { key: "newest", label: "최신순" },
];

export default function StorePage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">가전 쇼핑</h1>
      <p className="mt-2 text-sm text-sub">원하는 가전을 골라 담으면 세트 할인이 자동으로 적용됩니다.</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-soft" />}>
        <StoreView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function StoreView({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const category = sp.category && isStoreCategory(sp.category) ? sp.category : "";
  const brand = sp.brand ?? "";
  const sort = sp.sort ?? "";
  const q = (sp.q ?? "").trim().slice(0, 50);

  const [all, brands, rules] = await Promise.all([
    getStoreProducts({ category: category || undefined, brand: brand || undefined }),
    getBrands(),
    getActiveDiscountRules(),
  ]);

  let list = all;
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.productType.toLowerCase().includes(lower) ||
        p.models.some((m) => m.name.toLowerCase().includes(lower) || m.code.toLowerCase().includes(lower))
    );
  }
  list = [...list].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    switch (sort) {
      case "price_asc": return a.minPrice - b.minPrice;
      case "price_desc": return b.minPrice - a.minPrice;
      case "discount": return b.maxDiscountRate - a.maxDiscountRate;
      case "newest": return b.createdAt.localeCompare(a.createdAt);
      default: return Number(b.bundleEligible) - Number(a.bundleEligible) || a.minPrice - b.minPrice;
    }
  });

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(category && { category }), ...(brand && { brand }), ...(sort && { sort }), ...(q && { q }) });
    for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/store?${s}` : "/store";
  };
  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-navy text-white" : "bg-soft hover:bg-line"}`;

  return (
    <div className="mt-6">
      <div className="mb-6">
        <PromoBanner
          image={IMG.store}
          title="골라 담을수록 더 할인"
          desc="장바구니에 함께 담으면 세트 할인이 자동으로 적용됩니다."
        >
          {rules.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-white/85">
              {rules.map((r) => <li key={r.id}>· {r.name}: {describeRule(r)}</li>)}
            </ul>
          )}
        </PromoBanner>
      </div>

      <div className="space-y-3 border-b border-line pb-5">
        <div className="flex gap-2 overflow-x-auto">
          <Link href={href({ category: "" })} className={chip(!category)}>전체</Link>
          {STORE_CATEGORIES.map((c) => (
            <Link key={c.key} href={href({ category: c.key })} className={chip(category === c.key)}>{c.label}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ brand: "" })} className={chip(!brand)}>전체 브랜드</Link>
          {brands.map((b) => (
            <Link key={b.slug} href={href({ brand: b.slug })} className={chip(brand === b.slug)}>{b.name}</Link>
          ))}
          <form action="/store" className="ml-auto flex gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            {brand && <input type="hidden" name="brand" value={brand} />}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <input name="q" defaultValue={q} placeholder="제품명·모델명 검색" className="h-10 w-52 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy" />
            <button className="h-10 rounded-lg bg-navy px-4 text-sm font-bold text-white">검색</button>
          </form>
        </div>
        <div className="flex gap-3 text-sm">
          {SORTS.map((s) => (
            <Link key={s.key} href={href({ sort: s.key })} className={sort === s.key ? "font-bold text-navy" : "text-sub hover:text-ink"}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm text-sub">
        {q && <><b className="text-ink">‘{q}’</b> 검색 결과 · </>}총 <b className="tabular text-ink">{list.length}</b>개
      </p>

      {list.length === 0 ? (
        <div className="mt-4 rounded-xl bg-soft px-6 py-16 text-center text-sm text-sub">
          조건에 맞는 상품이 없습니다.
          <Link href="/store" className="mt-3 block font-semibold text-navy underline">조건 초기화</Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {list.map((p) => <StoreProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}