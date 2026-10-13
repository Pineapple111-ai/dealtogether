import { Suspense } from "react";
import type { Metadata } from "next";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";
import PromoBanner from "@/components/common/PromoBanner";
import { IMG } from "@/lib/images";

export const metadata: Metadata = { title: "전체 공동구매" };

export default function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight md:text-3xl">전체 공동구매</h1>
      <div className="mb-8">
        <PromoBanner
          image={IMG.groupbuy}
          title="함께 사면 달라지는 가격"
          desc="공간별로 구성한 삼성·LG 가전 패키지를 공동구매 가격으로 만나보세요."
        />
      </div>
      <Suspense fallback={<ListingSkeleton />}>
        <CampaignListing searchParams={searchParams} basePath="/campaigns" />
      </Suspense>
    </div>
  );
}