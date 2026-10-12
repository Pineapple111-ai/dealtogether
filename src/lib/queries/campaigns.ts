import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  toCampaignView,
  type CampaignRow,
  type CampaignStats,
  type CampaignView,
} from "@/lib/campaign";

// 공개 데이터 조회용 (anon key, RLS 적용)
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const CAMPAIGN_SELECT = `
  id, name, slug, start_at, end_at, target_participants, max_quantity,
  campaign_price, closing_soon_hours, manual_state,
  package:packages!inner(
    id, name, slug, summary, list_price, thumbnail_url, status,
    brand:brands!inner(name, slug, theme_color),
    category:categories!inner(name, slug)
  )
`;

export async function getCampaigns(opts: { brandSlug?: string; categorySlug?: string } = {}) {
  await connection(); // 서버 시간 기준 판단을 위해 요청 시점에 실행
  const sb = publicClient();

  let q = sb
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("is_visible", true)
    .eq("package.status", "active");
  if (opts.brandSlug) q = q.eq("package.brand.slug", opts.brandSlug);
  if (opts.categorySlug) q = q.eq("package.category.slug", opts.categorySlug);

  const { data, error } = await q;
  if (error) throw new Error(`캠페인 조회 실패: ${error.message}`);

  const rows = (data ?? []) as unknown as CampaignRow[];
  if (rows.length === 0) return { campaigns: [] as CampaignView[], serverNow: Date.now() };

  const { data: stats, error: statsError } = await sb
    .from("campaign_stats")
    .select("*")
    .in("campaign_id", rows.map((r) => r.id));
  if (statsError) throw new Error(`집계 조회 실패: ${statsError.message}`);

  const statsMap = new Map((stats as CampaignStats[]).map((s) => [s.campaign_id, s]));
  const serverNow = Date.now();
  return {
    campaigns: rows.map((r) => toCampaignView(r, statsMap.get(r.id), serverNow)),
    serverNow,
  };
}

export async function getCategories() {
  const sb = publicClient();
  const { data, error } = await sb
    .from("categories")
    .select("id, name, slug, image_url")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`카테고리 조회 실패: ${error.message}`);
  return data ?? [];
}