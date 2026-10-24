import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { publicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site";

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

const STATIC: { path: string; freq: Freq; priority: number }[] = [
  { path: "", freq: "daily", priority: 1 },
  { path: "/campaigns", freq: "daily", priority: 0.9 },
  { path: "/store", freq: "daily", priority: 0.9 },
  { path: "/closing-soon", freq: "daily", priority: 0.7 },
  { path: "/categories", freq: "weekly", priority: 0.7 },
  { path: "/brands/samsung", freq: "weekly", priority: 0.7 },
  { path: "/brands/lg", freq: "weekly", priority: 0.7 },
  { path: "/guide", freq: "monthly", priority: 0.5 },
  { path: "/support", freq: "monthly", priority: 0.4 },
  { path: "/support/faq", freq: "monthly", priority: 0.4 },
  { path: "/support/notices", freq: "weekly", priority: 0.4 },
  { path: "/support/delivery", freq: "monthly", priority: 0.3 },
  { path: "/policy/terms", freq: "yearly", priority: 0.2 },
  { path: "/policy/privacy", freq: "yearly", priority: 0.2 },
  { path: "/policy/refund", freq: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const sb = publicClient();
  const now = new Date();

  const [campaigns, products, categories, notices] = await Promise.all([
    sb.from("campaigns").select("slug, updated_at").eq("is_visible", true).is("manual_state", null),
    sb.from("products").select("id, updated_at").eq("store_visible", true).eq("status", "active"),
    sb.from("categories").select("slug").eq("is_active", true),
    sb.from("notices").select("id, updated_at").eq("is_published", true),
  ]);

  return [
    ...STATIC.map((s) => ({ url: `${SITE_URL}${s.path}`, lastModified: now, changeFrequency: s.freq, priority: s.priority })),
    ...(categories.data ?? []).map((c) => ({
      url: `${SITE_URL}/categories/${c.slug}`, lastModified: now, changeFrequency: "weekly" as Freq, priority: 0.6,
    })),
    ...(campaigns.data ?? []).map((c) => ({
      url: `${SITE_URL}/campaigns/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "daily" as Freq, priority: 0.8,
    })),
    ...(products.data ?? []).map((p) => ({
      url: `${SITE_URL}/store/${p.id}`, lastModified: new Date(p.updated_at), changeFrequency: "weekly" as Freq, priority: 0.7,
    })),
    ...(notices.data ?? []).map((n) => ({
      url: `${SITE_URL}/support/notices/${n.id}`, lastModified: new Date(n.updated_at), changeFrequency: "monthly" as Freq, priority: 0.3,
    })),
  ];
}