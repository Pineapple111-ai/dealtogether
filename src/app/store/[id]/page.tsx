import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PackageGallery from "@/components/purchase/PackageGallery";
import StorePurchasePanel from "@/components/store/StorePurchasePanel";
import { getStoreProductsByIds, getActiveDiscountRules } from "@/lib/queries/store";
import { STORE_CATEGORY_LABEL } from "@/lib/store";

type Props = { params: Promise<{ id: string }> };

export default function StoreProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-[600px] max-w-site animate-pulse px-4 pt-10" />}>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: Props) {
  const { id } = await params;
  const [[p], rules] = await Promise.all([getStoreProductsByIds([id]), getActiveDiscountRules()]);
  if (!p) notFound();

  const images = [p.thumbnail, ...p.models.map((m) => m.imageUrl)].filter(
    (x, i, arr): x is string => !!x && arr.indexOf(x) === i
  );

  return (
    <div className="mx-auto max-w-site px-4 pb-28 pt-6 md:px-6 lg:pb-0">
      <nav className="mb-6 flex gap-1.5 text-[13px] text-sub" aria-label="경로">
        <Link href="/store" className="hover:text-ink">가전 쇼핑</Link>
        <span>/</span>
        <Link href={`/store?category=${p.category}`} className="hover:text-ink">{STORE_CATEGORY_LABEL[p.category]}</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-14">
        <div className="space-y-10">
          <PackageGallery images={images} name={p.name} fallbackLabel={`${p.brand.name} ${p.productType}`} />

          {p.description && (
            <section>
              <h2 className="text-lg font-bold">상품 설명</h2>
              <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{p.description}</div>
            </section>
          )}

          <section className="rounded-xl bg-soft p-6 text-sm leading-relaxed text-sub">
            <h2 className="mb-2 font-bold text-ink">배송·설치 안내</h2>
            <p>대형 가전은 결제 확인 후 배송 일정을 별도로 조율하며, 설치가 필요한 제품은 설치 기사가 방문합니다.</p>
            <p className="mt-1">현장 환경에 따라 추가 설치비가 발생할 수 있으며, 발생 시 설치 전에 안내드립니다.</p>
          </section>
        </div>

        <StorePurchasePanel p={p} rules={rules} />
      </div>
    </div>
  );
}