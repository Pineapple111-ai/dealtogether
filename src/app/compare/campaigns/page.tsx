import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCampaignDetail } from "@/lib/queries/campaign-detail";
import { STATUS_LABEL } from "@/lib/campaign";
import { won, formatDate } from "@/lib/format";
import type { CampaignDetail } from "@/lib/pricing";
import CompareTable from "@/components/compare/CompareTable";
import RemoveCompareButton from "@/components/compare/RemoveCompareButton";

export const metadata: Metadata = { title: "공동구매 비교", robots: { index: false } };

type Props = { searchParams: Promise<{ ids?: string }> };

export default function CompareCampaignsPage(props: Props) {
  return (
    <div className="mx-auto max-w-site px-4 py-10 md:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">공동구매 비교</h1>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-soft" />}>
        <View {...props} />
      </Suspense>
    </div>
  );
}

async function View({ searchParams }: Props) {
  const { ids = "" } = await searchParams;
  const slugs = [...new Set(ids.split(",").map((s) => decodeURIComponent(s.trim())).filter((s) => /^[a-z0-9-]{3,80}$/.test(s)))].slice(0, 3);
  const list = (await Promise.all(slugs.map((s) => getCampaignDetail(s)))).filter((d): d is CampaignDetail => !!d);

  if (list.length === 0) {
    return (
      <div className="mt-8 rounded-xl bg-soft px-6 py-16 text-center text-sm text-sub">
        비교할 공동구매가 없습니다. 목록에서 <b>+ 비교</b>를 눌러 담아주세요.
        <Link href="/campaigns" className="mt-4 block font-semibold text-navy underline">공동구매 보러 가기</Link>
      </div>
    );
  }

  const keys = list.map((d) => d.campaign.slug);
  const minPrice = Math.min(...list.map((d) => d.campaign.campaignPrice));
  const maxRate = Math.max(...list.map((d) => d.campaign.discountRate));
  const best = (on: boolean, text: React.ReactNode) => (on ? <b className="text-navy">{text}</b> : text);

  return (
    <div className="mt-6 space-y-4">
      <CompareTable
        columns={list.map((d) => {
          const c = d.campaign;
          return {
            key: c.slug,
            header: (
              <div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-soft">
                  {c.package.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.package.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 text-xs font-bold" style={{ color: c.package.brand.theme_color ?? "#102a43" }}>{c.package.brand.name}</p>
                <p className="mt-0.5 font-bold leading-snug">{c.package.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Link href={`/campaigns/${c.slug}`} className="text-xs font-bold text-navy underline">상세보기</Link>
                  <RemoveCompareButton kind="campaign" id={c.slug} ids={keys} basePath="/compare/campaigns" />
                </div>
              </div>
            ),
          };
        })}
        rows={[
          { label: "상태", cells: list.map((d) => STATUS_LABEL[d.campaign.status]) },
          { label: "공간", cells: list.map((d) => d.campaign.package.category.name) },
          { label: "정상가", cells: list.map((d) => <span key="l" className="text-sub line-through">{won(d.campaign.listPrice)}</span>) },
          { label: "공동구매가", cells: list.map((d) => best(d.campaign.campaignPrice === minPrice, <span className="text-base font-extrabold">{won(d.campaign.campaignPrice)}</span>)) },
          { label: "할인율", cells: list.map((d) => best(d.campaign.discountRate === maxRate && maxRate > 0, <span className="font-bold text-coral">{d.campaign.discountRate}%</span>)) },
          {
            label: "구성품",
            cells: list.map((d) => (
              <ul key="items" className="space-y-1.5">
                {d.items.map((it) => {
                  const def = it.skus.find((s) => s.isDefault) ?? it.skus[0];
                  const model = def ? it.models.find((m) => m.id === def.modelId) : undefined;
                  return (
                    <li key={it.id}>
                      <b>{it.label}</b>
                      {!it.isRequired && <span className="ml-1 text-xs text-sub">(선택 +{won(it.optionalPrice)})</span>}
                      <span className="block text-xs text-sub">
                        기본 {model?.name ?? "-"}
                        {it.models.length > 1 && ` · 모델 ${it.models.length}종 선택 가능`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )),
          },
          { label: "참여 현황", cells: list.map((d) => `${d.campaign.participants}명 / 목표 ${d.campaign.targetParticipants}명`) },
          { label: "남은 수량", cells: list.map((d) => `${d.campaign.remaining}세트 / ${d.campaign.maxQuantity}세트`) },
          { label: "모집 기간", cells: list.map((d) => `${formatDate(d.campaign.startAt)} ~ ${formatDate(d.campaign.endAt)}`) },
          { label: "1인 한도", cells: list.map((d) => `${d.perUserLimit}세트`) },
        ]}
      />
      <p className="text-xs text-sub">가격은 기본 모델 기준입니다. 상위 모델이나 설치 옵션을 고르면 추가금이 붙습니다.</p>
    </div>
  );
}