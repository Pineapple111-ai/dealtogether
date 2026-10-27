import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 검색엔진·미리보기 봇 제외
const BOT = /bot|crawl|spider|slurp|yeti|daum|facebookexternalhit|kakaotalk-scrap|headless|lighthouse|preview|python|curl|wget/i;
const OWN = /(^|\.)dealtogether\.(kr|netlify\.app)$|^localhost$/;

const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done();

  let body: { path?: unknown; vid?: unknown; ref?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return done();
  }

  const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 300) : "";
  const vid = typeof body.vid === "string" ? body.vid : "";
  if (!path.startsWith("/") || /^\/(admin|api)(\/|$)/.test(path)) return done();
  if (!/^[0-9a-f-]{36}$/i.test(vid)) return done();

  let referrer: string | null = null;
  if (typeof body.ref === "string" && body.ref) {
    try {
      const host = new URL(body.ref).hostname.replace(/^www\./, "");
      if (host && !OWN.test(host)) referrer = host.slice(0, 100);
    } catch {
      /* 잘못된 주소 무시 */
    }
  }

  const { error } = await createAdminClient().from("page_views").insert({
    path,
    visitor_id: vid,
    referrer_host: referrer,
    device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
  });
  if (error) console.error("방문 기록 실패", error.message);
  return done();
}