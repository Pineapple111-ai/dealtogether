import Link from "next/link";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreProducts, getActiveDiscountRules } from "@/lib/queries/store";
import { STORE_CATEGORIES, describeRule } from "@/lib/store";

export default async function StoreSection() {
  const [products, rules] = await Promise.all([getStoreProducts(), getActiveDiscountRules()]);
  if (products.length === 0) return null;

  const picks = [...products]
    .filter((p) => p.inStock)
    .sort(
      (a, b) =>
        Number(b.bundleEligible) - Number(a.bundleEligible) ||
        b.maxDiscountRate - a.maxDiscountRate ||
        a.minPrice - b.minPrice
    )
    .slice(0, 8);

  const countBy = (key: string) => products.filter((p) => p.category === key && p.inStock).length;

  return (
    <section className="mx-auto max-w-site px-4 pt-20 md:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight md:text-[28px]">골라 담는 가전 쇼핑</h2>
          <p className="mt-1 text-sm text-sub">필요한 가전만 골라 담아도 세트 할인이 적용됩니다.</p>
        </div>
        <Link href="/store" className="shrink-0 text-sm font-semibold text-sub hover:text-navy">전체보기</Link>
      </div>

      {rules.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-navy px-5 py-4 text-sm text-white">
          <b className="text-base">세트 할인</b>
          {rules.map((r) => (
            <span key={r.id} className="text-white/80">{describeRule(r)}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STORE_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/store?category=${c.key}`}
            className="flex flex-col justify-between gap-6 rounded-xl border border-line bg-white p-5 transition-colors hover:border-navy/40"
          >
            <span>
              <span className="block text-lg font-bold">{c.label}</span>
              <span className="mt-0.5 block text-xs text-sub">{c.desc}</span>
            </span>
            <span className="tabular text-[13px] text-sub">상품 {countBy(c.key)}개</span>
          </Link>
        ))}
      </div>

      {picks.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {picks.map((p) => <StoreProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}