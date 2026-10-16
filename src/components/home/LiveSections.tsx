import Link from "next/link";
import CampaignCard from "@/components/campaign/CampaignCard";
import ImageTile from "@/components/common/ImageTile";
import PromoBanner from "@/components/common/PromoBanner";
import { getCampaigns, getCategories } from "@/lib/queries/campaigns";
import { IMG, spaceImage } from "@/lib/images";
import type { CampaignView } from "@/lib/campaign";

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

function Grid({ items, serverNow }: { items: CampaignView[]; serverNow: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <CampaignCard key={c.id} c={c} serverNow={serverNow} />
      ))}
    </div>
  );
}

const time = (iso: string) => new Date(iso).getTime();

export default async function LiveSections() {
  const [{ campaigns, serverNow }, categories] = await Promise.all([getCampaigns(), getCategories()]);
  const active = campaigns.filter((c) => c.isPurchasable);
  const upcoming = campaigns.filter((c) => c.status === "scheduled");
  const shown = [...active, ...upcoming];

  const stats = [
    { label: "진행 중인 공동구매", value: active.length, unit: "건" },
    { label: "오픈 예정", value: upcoming.length, unit: "건" },
    { label: "확정 참여 인원", value: active.reduce((s, c) => s + c.participants, 0), unit: "명" },
    { label: "마감 임박", value: active.filter((c) => c.status === "closing_soon").length, unit: "건" },
    { label: "목표 달성", value: campaigns.filter((c) => c.participants >= c.targetParticipants).length, unit: "건" },
  ];

  const closingSoon = [...active].sort((a, b) => time(a.endAt) - time(b.endAt)).slice(0, 4);
  const openingSoon = [...upcoming].sort((a, b) => time(a.startAt) - time(b.startAt)).slice(0, 8);
  const popular = [...active]
    .filter((c) => c.sold > 0)
    .sort((a, b) => b.sold - a.sold || b.participants - a.participants)
    .slice(0, 4);

  const brandCount = (slug: string) => shown.filter((c) => c.package.brand.slug === slug).length;

  return (
    <>
      {/* 실시간 현황 */}
      <section className="border-b border-line">
        <dl className="mx-auto grid max-w-site grid-cols-2 px-4 md:grid-cols-5 md:px-6">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`border-line py-6 md:py-8 ${i > 0 ? "md:border-l md:pl-5" : ""} ${
                i % 2 === 1 ? "border-l pl-5" : ""
              } ${i >= 2 ? "border-t md:border-t-0" : ""} ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}
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
                <span className="tabular text-sm text-white/80">공동구매 {brandCount(b.slug)}건</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 마감 임박 (진행 중일 때만) */}
      {closingSoon.length > 0 && (
        <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
          <SectionHead title="마감 임박 공동구매" desc="종료가 가까운 순서로 보여드려요" href="/closing-soon" />
          <Grid items={closingSoon} serverNow={serverNow} />
        </section>
      )}

      {/* 오픈 예정 */}
      {openingSoon.length > 0 && (
        <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
          <SectionHead title="오픈 예정 공동구매" desc="곧 시작하는 공동구매를 미리 확인하세요" href="/campaigns?status=scheduled" />
          <Grid items={openingSoon} serverNow={serverNow} />
        </section>
      )}

      {/* 인기 (판매 실적이 있을 때만) */}
      {popular.length > 0 && (
        <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
          <SectionHead title="인기 공동구매" desc="실제 판매 수량 기준" href="/campaigns?sort=popular" />
          <Grid items={popular} serverNow={serverNow} />
        </section>
      )}

      {/* 진행 중·예정 모두 없을 때 */}
      {shown.length === 0 && (
        <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
          <p className="rounded-xl bg-soft px-6 py-12 text-center text-sm text-sub">
            다음 공동구매를 준비하고 있습니다. 가전 쇼핑에서 원하는 제품을 골라보세요.
          </p>
        </section>
      )}

      {/* 공간별 패키지 */}
      <section className="mx-auto max-w-site px-4 pt-16 md:px-6">
        <SectionHead title="공간별 패키지" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((cat) => {
            const count = shown.filter((c) => c.package.category.slug === cat.slug).length;
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
      </section>
    </>
  );
}