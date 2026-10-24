import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneSchema } from "@/lib/phone";

const schema = z.object({
  orderNumber: z.string().trim().toUpperCase().regex(/^(\d{6}-\d{3}|DT-\d{8}-\d{6})$/, "주문번호 형식을 확인해주세요."),
  phone: phoneSchema,
});

const NOT_FOUND = "일치하는 주문이 없습니다. 주문번호와 주문 시 입력한 휴대폰 번호를 확인해주세요.";

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? NOT_FOUND }, { status: 400 });
  }

  // 무차별 대입 완화
  await new Promise((r) => setTimeout(r, 400));

  const { data } = await createAdminClient()
    .from("orders")
    .select("order_number, access_token")
    .eq("order_number", parsed.data.orderNumber)
    .eq("buyer_phone", parsed.data.phone)
    .maybeSingle();

  if (!data) return NextResponse.json({ message: NOT_FOUND }, { status: 404 });
  return NextResponse.json({ orderNumber: data.order_number, token: data.access_token });
}