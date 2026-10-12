import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccessibleOrder } from "@/lib/queries/order-access";

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : null;

  const order = await findAccessibleOrder(orderNumber, token);
  if (!order) return NextResponse.json({ message: "주문을 찾을 수 없습니다." }, { status: 404 });

  if (!["pending_payment", "payment_verification"].includes(order.status)) {
    return NextResponse.json(
      { message: "결제 전 주문만 직접 취소할 수 있습니다. 결제 완료 주문은 고객센터로 문의해주세요." },
      { status: 409 }
    );
  }

  // p_actor = null → DB에서 '결제 전 취소'만 허용
  const { error } = await createAdminClient().rpc("change_order_status", {
    p_order_id: order.id,
    p_new_status: "cancelled",
    p_actor: null,
    p_reason: "고객 취소 요청",
  });

  if (error) {
    console.error("고객 취소 실패", error);
    return NextResponse.json({ message: "주문 취소 중 오류가 발생했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}