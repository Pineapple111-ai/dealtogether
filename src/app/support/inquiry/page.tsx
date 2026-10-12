import { Suspense } from "react";
import type { Metadata } from "next";
import { publicClient } from "@/lib/supabase/public";
import InquiryForm from "@/components/support/InquiryForm";

export const metadata: Metadata = { title: "1:1 문의" };

type Props = { searchParams: Promise<{ campaign?: string }> };

export default function InquiryPage(props: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">1:1 문의</h1>
      <p className="mb-8 mt-2 text-sm text-sub">상품, 주문, 배송·설치 등 궁금한 점을 남겨주세요.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-soft" />}>
        <FormLoader {...props} />
      </Suspense>
    </div>
  );
}

async function FormLoader({ searchParams }: Props) {
  const { campaign } = await searchParams;
  let name: string | undefined;
  if (campaign) {
    const { data } = await publicClient()
      .from("campaigns")
      .select("package:packages(name)")
      .eq("slug", campaign)
      .maybeSingle();
    name = (data as unknown as { package: { name: string } } | null)?.package.name;
  }
  return <InquiryForm campaignSlug={name ? campaign : undefined} campaignName={name} />;
}