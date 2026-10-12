import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaignDetail } from "@/lib/queries/campaign-detail";
import PackageGallery from "@/components/purchase/PackageGallery";
import PurchasePanel from "@/components/purchase/PurchasePanel";

type Params = { params: Promise<{ slug: string }> };

export default function CampaignPage({ params }: Params) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CampaignDetailView params={params} />
    </Suspense>
  );
}

async function CampaignDetailView({ params }: Params) {
  const { slug } = await params;
  const detail = await getCampaignDetail(decodeURIComponent(slug));
  if (!detail) notFound();

  const c = detail.campaign;

  return (
    <div className="mx-auto max-w-site px-4 pb-28 pt-6 md:px-6 lg:pb-0">
      <nav className="mb-6 flex gap-1.5 text-[13px] text-sub" aria-label="경로">
        <Link href="/" className="hover:text-ink">홈</Link>
        <span>/</span>
        <Link href={`/brands/${c.package.brand.slug}`} className="hover:text-ink">{c.package.brand.name}</Link>
        <span>/</span>
        <Link href={`/categories/${c.package.category.slug}`} className="hover:text-ink">{c.package.category.name}</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-14">
        {/* 좌측 */}
        <div className="space-y-10">
          <PackageGallery
            images={detail.images}
            name={c.package.name}
            fallbackLabel={`${c.package.brand.name} ${c.package.category.name} 패키지`}
          />

          <section>
            <h2 className="text-lg font-bold">패키지 구성</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {detail.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-4 text-sm">
                  <span>
                    <b>{i.label}</b>
                    <span className="ml-2 text-sub">{i.productName}</span>
                  </span>
                  <span className={i.isRequired ? "font-semibold text-navy" : "text-sub"}>
                    {i.isRequired ? "기본 포함" : "선택 추가"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {detail.description && (
            <section>
              <h2 className="text-lg font-bold">상세 설명</h2>
              <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">
                {detail.description}
              </div>
            </section>
          )}

          <section className="rounded-xl bg-soft p-6 text-sm leading-relaxed text-sub">
            <h2 className="mb-2 font-bold text-ink">배송·설치 안내</h2>
            <p>대형 가전은 결제 확인 후 배송 일정을 별도로 조율하며, 설치가 필요한 제품은 설치 기사가 방문합니다.</p>
            <p className="mt-1">현장 환경에 따라 추가 설치비가 발생할 수 있으며, 발생 시 설치 전에 안내드립니다.</p>
          </section>

          <Link
            href={`/support/inquiry?campaign=${c.slug}`}
            className="flex items-center justify-between rounded-xl border border-line px-6 py-5 hover:border-navy/40"
          >
            <span>
              <b>구매 전 상담이 필요하신가요?</b>
              <span className="block text-sm text-sub">설치 환경, 모델 선택 등 궁금한 점을 남겨주세요.</span>
            </span>
            <span className="text-sm font-bold text-navy">상담 문의</span>
          </Link>
        </div>

        {/* 우측 */}
        <PurchasePanel detail={detail} />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-site gap-10 px-4 pt-12 md:px-6 lg:grid-cols-[1fr_500px]">
      <div className="aspect-square animate-pulse rounded-xl bg-soft" />
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded bg-soft" />
        <div className="h-40 animate-pulse rounded-xl bg-soft" />
        <div className="h-64 animate-pulse rounded-xl bg-soft" />
      </div>
    </div>
  );
}