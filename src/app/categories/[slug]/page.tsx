import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";
import { getCategoryBySlug } from "@/lib/queries/listing";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SPACE_NAME: Record<string, string> = {
  living: "거실", kitchen: "주방", laundry: "세탁·건조", aircare: "에어케어", life: "생활가전",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = SPACE_NAME[slug] ?? "공간별";
  return {
    title: `${name} 패키지`,
    description: `${name} 가전 패키지 공동구매. 삼성·LG 가전을 함께 구매하는 딜투게더.`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

export default function CategoryPage(props: Props) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <Suspense fallback={<ListingSkeleton />}>
        <CategoryView {...props} />
      </Suspense>
    </div>
  );
}

async function CategoryView({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <>
      <Link href="/categories" className="text-sm text-sub hover:text-ink">← 공간별 패키지</Link>
      <h1 className="mb-6 mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{category.name} 패키지</h1>
      <CampaignListing searchParams={searchParams} basePath={`/categories/${slug}`} fixed={{ categorySlug: slug }} />
    </>
  );
}