import { Suspense } from "react";
import type { Metadata } from "next";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";

export const metadata: Metadata = { title: "마감 임박" };

export default function ClosingSoonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-coral md:text-3xl">마감 임박 공동구매</h1>
      <p className="mb-6 mt-2 text-sm text-sub">곧 모집이 끝나는 공동구매입니다.</p>
      <Suspense fallback={<ListingSkeleton />}>
        <CampaignListing searchParams={searchParams} basePath="/closing-soon" fixed={{ status: "closing_soon" }} />
      </Suspense>
    </div>
  );
}