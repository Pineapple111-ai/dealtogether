import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCampaigns, getCategories } from "@/lib/queries/campaigns";
import ImageTile from "@/components/common/ImageTile";
import { spaceImage } from "@/lib/images";

export const metadata: Metadata = { title: "공간별 패키지" };

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">공간별 패키지</h1>
      <p className="mt-2 text-sm text-sub">집안 공간에 맞춰 구성한 가전 패키지를 확인해보세요.</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-soft" />}>
        <CategoryGrid />
      </Suspense>
    </div>
  );
}

async function CategoryGrid() {
  const [categories, { campaigns }] = await Promise.all([getCategories(), getCampaigns()]);
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {categories.map((cat) => {
        const count = campaigns.filter(
          (c) => (c.isPurchasable || c.status === "scheduled") && c.package.category.slug === cat.slug
        ).length;
        return (
          <ImageTile
            key={cat.id}
            href={`/categories/${cat.slug}`}
            image={spaceImage(cat.slug) ?? cat.image_url}
            title={cat.name}
            meta={`공동구매 ${count}건`}
          />
        );
      })}
    </div>
  );
}