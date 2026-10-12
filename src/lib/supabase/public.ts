import { createClient } from "@supabase/supabase-js";

/** 공개 데이터 조회용 (anon key, RLS 적용) */
export function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}