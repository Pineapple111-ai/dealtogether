import Link from "next/link";
import { Suspense } from "react";
import CampaignCard from "./CampaignCard";
import ListingControls from "./ListingControls";
import { getCampaigns, getCategories } from "@/lib/queries/campaigns";
import { getBrands, searchPackageIds } from "@/lib/queries/listing";
import type { CampaignView } from "@/lib/campaign";

type SP = Record<string, string | string[] | undefined>;

const STATUS_FILTERS = [
  { key: "", label: "전체" },
  { key: "scheduled", label: "모집 예정" },
  { key: "open", label: "모집 중" },
  { key: "closing_soon", label: "마감 임박" },
  { key: "target_reached", label: "목표 달성" },
  { key: "ended", label: "모집 종료" },
];

function matchStatus(c: CampaignView, key: string) {
  switch (key) {
    case "scheduled": return c.status === "scheduled";
    case "open": return c.isPurchasable;
    case "closing_soon": return c.status === "closing_soon";
    case "target_reached": return c.isPurchasable && c.participants >= c.targetParticipants;
    case "ended": return c.status === "closed" || c.status === "sold_out";
    default: return c.isPurchasable || c.status === "scheduled";
  }
}

const RANK: Record<string, number> = { closing_soon: 0, target_reached: 1, open: 2, scheduled: 3, sold_out: 4, closed: 5, cancelled: 6 };
const end = (c: CampaignView) => new Date(c.endAt).getTime();

function sortList(list: CampaignView[], sort: string) {
  const l = [...list];
  switch (sort) {
    case "popular": return l.sort((a, b) => b.sold - a.sold || b.participants - a.participants);
    case "discount": return l.sort((a, b) => b.discountRate - a.discountRate);
    case "price_asc": return l.sort((a, b) => a.campaignPrice - b.campaignPrice);
    case "price_desc": return l.sort((a, b) => b.campaignPrice - a.campaignPrice);
    case "closing": return l.sort((a, b) => end(a) - end(b));
    case "newest": return l.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    default: return l.sort((a, b) => RANK[a.status] - RANK[b.status] || end(a) - end(b));
  }
}

export type ListingFixed = { brandSlug?: string; categorySlug?: string; status?: string };

export default async function CampaignListing({
  searchParams,
  basePath,
  fixed = {},
}: {
  searchParams: Promise<SP>;
  basePath: string;
  fixed?: ListingFixed;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const brand = fixed.brandSlug ?? get("brand");
  const category = fixed.categorySlug ?? get("category");
  const status = fixed.status ?? get("status");
  const sort = get("sort") || "recommended";
  const q = get("q").trim().slice(0, 50);

  const [{ campaigns, serverNow }, brands, categories, matched] = await Promise.all([
    getCampaigns({ brandSlug: brand || undefined, categorySlug: category || undefined }),
    fixed.brandSlug ? Promise.resolve([]) : getBrands(),
    fixed.categorySlug ? Promise.resolve([]) : getCategories(),
    q ? searchPackageIds(q) : Promise.resolve(null),
  ]);

  let list = campaigns.filter((c) => c.status !== "cancelled" && matchStatus(c, status));
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(
      (c) =>
        c.package.name.toLowerCase().includes(lower) ||
        c.name.toLowerCase().includes(lower) ||
        (c.package.summary ?? "").toLowerCase().includes(lower) ||
        matched?.has(c.package.id)
    );
  }
  list = sortList(list, sort);

  // 필터 링크 (고정 조건은 URL에 넣지 않음)
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = {
      ...(!fixed.brandSlug && brand && { brand }),
      ...(!fixed.categorySlug && category && { category }),
      ...(!fixed.status && status && { status }),
      ...(sort !== "recommended" && { sort }),
      ...(q && { q }),
      ...patch,
    };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-navy text-white" : "bg-soft text-ink hover:bg-line"
    }`;

  return (
    <div>
      <div className="space-y-3 border-b border-line pb-5">
        {!fixed.brandSlug && (
          <div className="flex gap-2 overflow-x-auto">
            <Link href={href({ brand: "" })} className={chip(!brand)}>전체 브랜드</Link>
            {brands.map((b) => (
              <Link key={b.slug} href={href({ brand: b.slug })} className={chip(brand === b.slug)}>{b.name}</Link>
            ))}
          </div>
        )}
        {!fixed.categorySlug && (
          <div className="flex gap-2 overflow-x-auto">
            <Link href={href({ category: "" })} className={chip(!category)}>전체 공간</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={href({ category: c.slug })} className={chip(category === c.slug)}>{c.name}</Link>
            ))}
          </div>
        )}
        {!fixed.status && (
          <div className="flex gap-2 overflow-x-auto">
            {STATUS_FILTERS.map((s) => (
              <Link key={s.key} href={href({ status: s.key })} className={chip(status === s.key)}>{s.label}</Link>
            ))}
          </div>
        )}
        <Suspense fallback={<div className="h-11" />}>
          <ListingControls />
        </Suspense>
      </div>

      <p className="mt-5 text-sm text-sub">
        {q && <><b className="text-ink">‘{q}’</b> 검색 결과 · </>}총 <b className="tabular text-ink">{list.length}</b>건
      </p>

      {list.length === 0 ? (
        <div className="mt-4 rounded-xl bg-soft px-6 py-16 text-center">
          <p className="text-sm text-sub">조건에 맞는 공동구매가 없습니다.</p>
          <Link href={basePath} className="mt-4 inline-block text-sm font-semibold text-navy underline underline-offset-4">
            조건 초기화
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => (
            <CampaignCard key={c.id} c={c} serverNow={serverNow} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-soft" />
      ))}
    </div>
  );
}