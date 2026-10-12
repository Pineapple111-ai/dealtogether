import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/staff";

const schema = z.object({
  status: z.enum([
    "pending_payment", "payment_verification", "preparing", "shipping", "delivered",
    "installation_scheduled", "completed", "cancelled", "expired", "refunded",
  ]),
  reason: z.string().trim().max(500).optional().default(""),
  restock: z.boolean().optional().default(true),
});

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const staff = await getStaff();
  if (!staff || !["super_admin", "order_admin"].includes(staff.role)) {
    return NextResponse.json({ code: "FORBIDDEN", message: "주문 상태 변경 권한이 없습니다." }, { status: 403 });
  }

  const { orderNumber } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION", message: "입력값을 확인해주세요." }, { status: 400 });
  }
  const b = parsed.data;
  if (["cancelled", "refunded"].includes(b.status) && b.reason.length < 2) {
    return NextResponse.json({ code: "REASON_REQUIRED", message: "취소·환불 사유를 입력해주세요." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await db.rpc("change_order_status", {
    p_order_id: order.id,
    p_new_status: b.status,
    p_actor: staff.id,
    p_reason: b.reason || null,
    p_restock: b.restock,
  });

  if (error) {
    const code = error.message.split(":")[0].trim();
    if (code === "INVALID_TRANSITION") {
      return NextResponse.json({ code, message: "현재 상태에서 변경할 수 없는 상태입니다." }, { status: 409 });
    }
    console.error("change_order_status 실패", error);
    return NextResponse.json({ code: "FAILED", message: "상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}