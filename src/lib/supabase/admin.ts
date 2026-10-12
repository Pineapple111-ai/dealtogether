// 서버 전용 (service_role, RLS 우회) — 절대 클라이언트 컴포넌트에서 import 금지
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("admin client는 서버에서만 사용할 수 있습니다.");
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}