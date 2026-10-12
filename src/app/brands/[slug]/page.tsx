import { Suspense } from "react";
import { notFound } from "next/navigation";
import CampaignListing, { ListingSkeleton } from "@/components/campaign/CampaignListing";
import { getBrandBySlug } from "@/lib/queries/listing";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function BrandPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-site px-4 py-10 md:px-6"><ListingSkeleton /></div>}>
      <BrandView {...props} />
    </Suspense>
  );
}

async function BrandView({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  return (
    <>
      <section className="text-white" style={{ backgroundColor: brand.theme_color ?? "#102a43" }}>
        <div className="mx-auto max-w-site px-4 py-12 md:px-6 md:py-16">
          <p className="text-sm font-semibold text-white/70">브랜드 기획전</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">{brand.name} 공동구매</h1>
        </div>
      </section>
      <div className="mx-auto max-w-site px-4 py-10 md:px-6">
        <CampaignListing searchParams={searchParams} basePath={`/brands/${slug}`} fixed={{ brandSlug: slug }} />
      </div>
    </>
  );
}