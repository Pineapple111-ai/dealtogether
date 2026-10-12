import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";
import { getCategoryBySlug } from "@/lib/queries/listing";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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