import { connection } from "next/server";
import { publicClient } from "@/lib/supabase/public";

export type HeroBanner = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  image_pc: string;
  image_mobile: string | null;
  button_label: string | null;
  link_url: string | null;
};

export type HomePopup = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  button_label: string | null;
  link_url: string | null;
};

type Period = { start_at: string | null; end_at: string | null };
const inPeriod = (x: Period, now: number) =>
  (!x.start_at || new Date(x.start_at).getTime() <= now) && (!x.end_at || new Date(x.end_at).getTime() > now);

export async function getActiveBanners(): Promise<HeroBanner[]> {
  await connection();
  const { data } = await publicClient()
    .from("banners")
    .select("id, eyebrow, title, subtitle, image_pc, image_mobile, button_label, link_url, start_at, end_at")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  const now = Date.now();
  return ((data ?? []) as (HeroBanner & Period)[]).filter((b) => inPeriod(b, now));
}

export async function getActivePopups(): Promise<HomePopup[]> {
  await connection();
  const { data } = await publicClient()
    .from("popups")
    .select("id, title, body, image_url, button_label, link_url, start_at, end_at")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  const now = Date.now();
  return ((data ?? []) as (HomePopup & Period)[]).filter((p) => inPeriod(p, now));
}