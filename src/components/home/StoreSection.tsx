import Link from "next/link";
import StoreProductCard from "@/components/store/StoreProductCard";
import ImageTile from "@/components/common/ImageTile";
import PromoBanner from "@/components/common/PromoBanner";
import { getStoreProducts, getActiveDiscountRules } from "@/lib/queries/store";
import { STORE_CATEGORIES, describeRule } from "@/lib/store";
import { IMG, storeCategoryImage } from "@/lib/images";

export default async function StoreSection() {
  const [products, rules] = await Promise.all([getStoreProducts(), getActiveDiscountRules()]);

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

      <PromoBanner
        image={IMG.store}
        title="골라 담을수록 더 할인"
        desc="원하는 가전을 자유롭게 조합하세요. 세트 할인이 자동으로 적용됩니다."
        href="/store"
        cta="가전 쇼핑하기"
      >
        {rules.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-white/85">
            {rules.map((r) => <li key={r.id}>· {describeRule(r)}</li>)}
          </ul>
        )}
      </PromoBanner>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STORE_CATEGORIES.map((c) => (
          <ImageTile
            key={c.key}
            href={`/store?category=${c.key}`}
            image={storeCategoryImage(c.key)}
            title={c.label}
            sub={c.desc}
            meta={`상품 ${countBy(c.key)}개`}
          />
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