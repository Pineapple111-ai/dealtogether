import Link from "next/link";
import CampaignCard from "@/components/campaign/CampaignCard";
import { getCampaigns, getCategories } from "@/lib/queries/campaigns";
import type { CampaignView } from "@/lib/campaign";
import ImageTile from "@/components/common/ImageTile";
import PromoBanner from "@/components/common/PromoBanner";
import { IMG, spaceImage } from "@/lib/images";

function SectionHead({ title, desc, href }: { title: string; desc?: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-[28px]">{title}</h2>
        {desc && <p className="mt-1 text-sm text-sub">{desc}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-sub hover:text-navy">
          전체보기
        </Link>
      )}
    </div>
  );
}

function Grid({ items, serverNow, empty }: { items: CampaignView[]; serverNow: number; empty: string }) {
  if (items.length === 0) {
    return <p className="rounded-xl bg-soft px-6 py-12 text-center text-sm text-sub">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <CampaignCard key={c.id} c={c} serverNow={serverNow} />
      ))}
    </div>
  );
}

export default async function LiveSections() {
  const [{ campaigns, serverNow }, categories] = await Promise.all([getCampaigns(), getCategories()]);
  const active = campaigns.filter((c) => c.isPurchasable);

  const stats = [
    { label: "진행 중인 공동구매", value: active.length, unit: "건" },
    { label: "확정 참여 인원", value: active.reduce((s, c) => s + c.participants, 0), unit: "명" },
    { label: "마감 임박", value: active.filter((c) => c.status === "closing_soon").length, unit: "건" },
    { label: "목표 달성", value: campaigns.filter((c) => c.participants >= c.targetParticipants).length, unit: "건" },
  ];

  const closingSoon = [...active]
    .sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime())
    .slice(0, 4);

  // 실제 판매 기준 인기순 (판매 0건은 제외)
  const popular = [...active]
    .filter((c) => c.sold > 0)
    .sort((a, b) => b.sold - a.sold || b.participants - a.participants)
    .slice(0, 4);

  const brandCount = (slug: string) => active.filter((c) => c.package.brand.slug === slug).length;

  return (
    <>
      {/* 실시간 현황 */}
      <section className="border-b border-line">
        <dl className="mx-auto grid max-w-site grid-cols-2 px-4 md:grid-cols-4 md:px-6">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`py-6 md:py-8 ${i % 2 === 1 ? "pl-5 border-l border-line" : ""} ${
                i >= 2 ? "border-t border-line md:border-t-0" : ""
              } ${i === 2 ? "md:pl-5 md:border-l" : ""}`}
            >
              <dt className="text-[13px] text-sub">{s.label}</dt>
              <dd className="tabular mt-1 text-2xl font-extrabold text-navy md:text-3xl">
                {s.value.toLocaleString("ko-KR")}
                <span className="ml-0.5 text-base font-bold">{s.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 공동구매 기획전 배너 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <PromoBanner
          image={IMG.groupbuy}
          title="공간별로 구성한 가전 패키지"
          desc="거실·주방·세탁 가전을 한 번에, 공동구매 가격으로 만나보세요."
          href="/campaigns"
          cta="공동구매 전체보기"
        />
      </section>

      {/* 브랜드별 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <SectionHead title="브랜드별 공동구매" />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { slug: "samsung", name: "삼성전자", color: "bg-brand-samsung" },
            { slug: "lg", name: "LG전자", color: "bg-brand-lg" },
          ].map((b) => (
            <Link
              key={b.slug}
              href={`/brands/${b.slug}`}
              className={`${b.color} flex min-h-40 flex-col justify-between rounded-xl p-7 text-white transition-opacity hover:opacity-95`}
            >
              <span className="text-sm font-semibold text-white/80">브랜드 기획전</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-extrabold">{b.name}</span>
                <span className="tabular text-sm text-white/80">진행 중 {brandCount(b.slug)}건</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 마감 임박 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <SectionHead title="마감 임박 공동구매" desc="종료가 가까운 순서로 보여드려요" href="/closing-soon" />
        <Grid items={closingSoon} serverNow={serverNow} empty="진행 중인 공동구매가 없습니다." />
      </section>

      {/* 인기 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <SectionHead title="인기 공동구매" desc="실제 판매 수량 기준" href="/campaigns?sort=popular" />
        <Grid items={popular} serverNow={serverNow} empty="아직 판매 집계가 없습니다. 첫 참여자가 되어보세요." />
      </section>

      {/* 공간별 패키지 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <SectionHead title="공간별 패키지" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((cat) => {
            const count = active.filter((c) => c.package.category.slug === cat.slug).length;
            return (
              <ImageTile
                key={cat.id}
                href={`/categories/${cat.slug}`}
                image={spaceImage(cat.slug) ?? cat.image_url}
                title={cat.name}
                meta={`진행 중 ${count}건`}
              />
            );
          })}
        </div>
      </section>
    </>
  );
}