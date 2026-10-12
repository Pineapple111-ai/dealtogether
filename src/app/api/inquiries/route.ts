import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { phoneSchema } from "@/lib/phone";

export const INQUIRY_CATEGORIES = ["상품", "주문·결제", "배송·설치", "취소·환불", "기타"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(30),
  phone: phoneSchema,
  email: z.union([z.string().trim().email("이메일 형식을 확인해주세요.").max(100), z.literal("")]),
  category: z.enum(INQUIRY_CATEGORIES, { message: "문의 유형을 선택해주세요." }),
  campaignSlug: z.string().max(100).optional().default(""),
  orderNumber: z.union([z.string().trim().toUpperCase().regex(/^DT-\d{8}-\d{6}$/, "주문번호 형식을 확인해주세요."), z.literal("")]),
  content: z.string().trim().min(10, "문의 내용을 10자 이상 입력해주세요.").max(3000),
  agreePrivacy: z.literal(true, { message: "개인정보 수집·이용에 동의해주세요." }),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." }, { status: 400 });
  }
  const b = parsed.data;
  const db = createAdminClient();

  // 같은 번호 10분 내 3건 제한
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("phone", b.phone)
    .gte("created_at", since);
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ message: "잠시 후 다시 문의해주세요." }, { status: 429 });
  }

  let userId: string | null = null;
  try {
    const { data } = await (await createSessionClient()).auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  let campaignId: string | null = null;
  if (b.campaignSlug) {
    const { data } = await db.from("campaigns").select("id").eq("slug", b.campaignSlug).maybeSingle();
    campaignId = data?.id ?? null;
  }

  const { error } = await db.from("inquiries").insert({
    user_id: userId,
    name: b.name,
    phone: b.phone,
    email: b.email || null,
    category: b.category,
    campaign_id: campaignId,
    order_number: b.orderNumber || null,
    content: b.content,
  });
  if (error) {
    console.error("문의 저장 실패", error);
    return NextResponse.json({ message: "문의 접수 중 오류가 발생했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, member: !!userId });
}