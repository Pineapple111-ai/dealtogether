import { Suspense } from "react";
import type { Metadata } from "next";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";

export const metadata: Metadata = { title: "전체 공동구매" };

export default function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight md:text-3xl">전체 공동구매</h1>
      <Suspense fallback={<ListingSkeleton />}>
        <CampaignListing searchParams={searchParams} basePath="/campaigns" />
      </Suspense>
    </div>
  );
}