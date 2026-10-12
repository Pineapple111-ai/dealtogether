import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 이메일 인증 / 비밀번호 재설정 링크 처리 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/mypage";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/mypage";

  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}