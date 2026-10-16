import Link from "next/link";
import Countdown from "./Countdown";
import { won, formatDate } from "@/lib/format";
import { STATUS_LABEL, type CampaignView } from "@/lib/campaign";

const BADGE: Record<string, string> = {
  closing_soon: "bg-coral text-white",
  target_reached: "bg-navy text-white",
  open: "bg-white text-navy border border-navy/20",
  scheduled: "bg-soft text-sub",
  closed: "bg-soft text-sub",
  sold_out: "bg-soft text-sub",
  cancelled: "bg-soft text-sub",
};

export default function CampaignCard({ c, serverNow }: { c: CampaignView; serverNow: number }) {
  const brandColor = c.package.brand.theme_color ?? "#102a43";
  const dimmed = !c.isPurchasable && c.status !== "scheduled";

  return (
    <Link
      href={`/campaigns/${c.slug}`}
      className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-navy/40 ${
        dimmed ? "opacity-70" : ""
      }`}
    >
      {/* 이미지 */}
      <div className="relative aspect-[4/3] bg-soft">
        {c.package.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.package.thumbnail_url} alt={c.package.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-end p-5">
            <span className="text-sm font-semibold" style={{ color: brandColor }}>
              {c.package.category.name} 패키지
            </span>
          </div>
        )}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[c.status]}`}>
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] font-bold" style={{ color: brandColor }}>
          {c.package.brand.name}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[17px] font-bold leading-snug">{c.package.name}</h3>
        {c.package.summary && <p className="mt-1 line-clamp-1 text-sm text-sub">{c.package.summary}</p>}

        {/* 가격 */}
        <div className="mt-4">
          {c.discountRate > 0 && (
            <p className="tabular text-sm text-sub line-through">{won(c.listPrice)}</p>
          )}
          <p className="tabular flex items-baseline gap-2">
            {c.discountRate > 0 && <span className="text-xl font-extrabold text-coral">{c.discountRate}%</span>}
            <span className="text-xl font-extrabold">{won(c.campaignPrice)}</span>
          </p>
        </div>

        {/* 모집 현황 */}
        <div className="mt-4">
          <div className="flex justify-between text-[13px]">
            <span className="tabular">
              <b className="text-navy">{c.participants}명</b>
              <span className="text-sub"> / 목표 {c.targetParticipants}명</span>
            </span>
            <span className="tabular font-semibold text-navy">{c.progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-navy" style={{ width: `${c.progress}%` }} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
          <span className="text-sub">
            잔여 <b className="tabular text-ink">{c.remaining}</b>세트
          </span>
          {c.status === "scheduled" ? (
            <span className="tabular font-semibold text-navy">{formatDate(c.startAt)} 오픈</span>
          ) : c.isPurchasable ? (
            <span className={c.status === "closing_soon" ? "font-semibold text-coral" : "text-ink"}>
              <Countdown endAt={c.endAt} serverNow={serverNow} />
            </span>
          ) : (
            <span className="text-sub">{STATUS_LABEL[c.status]}</span>
          )}
        </div>

        <span className="mt-4 rounded-lg bg-navy py-3 text-center text-sm font-bold text-white transition-colors group-hover:bg-navy-700">
          상세보기
        </span>
      </div>
    </Link>
  );
}