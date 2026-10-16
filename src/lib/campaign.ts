import { discountRate } from "@/lib/format";

export type CampaignStatus =
  | "scheduled"
  | "open"
  | "closing_soon"
  | "target_reached"
  | "closed"
  | "sold_out"
  | "cancelled";

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  scheduled: "오픈 예정",
  open: "모집 중",
  closing_soon: "마감 임박",
  target_reached: "목표 달성",
  closed: "모집 마감",
  sold_out: "판매 완료",
  cancelled: "취소",
};

export const DEFAULT_CLOSING_SOON_HOURS = 48;

export type CampaignRow = {
  id: string;
  name: string;
  slug: string;
  start_at: string;
  end_at: string;
  target_participants: number;
  max_quantity: number;
  campaign_price: number;
  closing_soon_hours: number | null;
  manual_state: "closed" | "cancelled" | null;
  package: {
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    list_price: number;
    thumbnail_url: string | null;
    brand: { name: string; slug: string; theme_color: string | null };
    category: { name: string; slug: string };
  };
};

export type CampaignStats = {
  campaign_id: string;
  participants: number;
  sold_quantity: number;
  reserved_quantity: number;
};

export type CampaignView = {
  id: string;
  name: string;
  slug: string;
  startAt: string;
  endAt: string;
  targetParticipants: number;
  maxQuantity: number;
  campaignPrice: number;
  listPrice: number;
  discountRate: number;
  participants: number;
  sold: number;
  remaining: number;
  progress: number; // 0~100
  status: CampaignStatus;
  isPurchasable: boolean;
  package: CampaignRow["package"];
};

export function toCampaignView(
  row: CampaignRow,
  stats: CampaignStats | undefined,
  now: number
): CampaignView {
  const participants = stats?.participants ?? 0;
  const sold = stats?.sold_quantity ?? 0;
  const reserved = stats?.reserved_quantity ?? 0;
  const remaining = Math.max(row.max_quantity - sold - reserved, 0);
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  const soonMs = (row.closing_soon_hours ?? DEFAULT_CLOSING_SOON_HOURS) * 3600_000;

  let status: CampaignStatus;
  if (row.manual_state === "cancelled") status = "cancelled";
  else if (row.manual_state === "closed" || now >= end) status = "closed";
  else if (now < start) status = "scheduled";
  else if (remaining <= 0) status = "sold_out";
  else if (participants >= row.target_participants) status = "target_reached";
  else if (end - now <= soonMs) status = "closing_soon";
  else status = "open";

  const isPurchasable = ["open", "closing_soon", "target_reached"].includes(status);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startAt: row.start_at,
    endAt: row.end_at,
    targetParticipants: row.target_participants,
    maxQuantity: row.max_quantity,
    campaignPrice: row.campaign_price,
    listPrice: row.package.list_price,
    discountRate: discountRate(row.package.list_price, row.campaign_price),
    participants,
    sold,
    remaining,
    progress: Math.min(Math.round((participants / row.target_participants) * 100), 100),
    status,
    isPurchasable,
    package: row.package,
  };
}

/** 진행 중(구매 가능 또는 예정) 여부 */
export function isActive(c: CampaignView) {
  return c.isPurchasable;
}