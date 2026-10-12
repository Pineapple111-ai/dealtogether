import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/staff";

const schema = z.object({
  confirmedAmount: z.number().int().nonnegative(),
  providerName: z.string().trim().max(50).optional().default(""),
  txId: z.string().trim().max(100).optional().default(""),
  memo: z.string().trim().max(500).optional().default(""),
  force: z.boolean().optional().default(false),
});

const ERRORS: Record<string, [number, string]> = {
  ORDER_NOT_FOUND: [404, "주문을 찾을 수 없습니다."],
  ALREADY_PAID: [409, "이미 결제 확인된 주문입니다."],
  INVALID_STATUS: [409, "결제 확인을 할 수 없는 주문 상태입니다."],
  INVALID_AMOUNT: [400, "확인 금액을 입력해주세요."],
  AMOUNT_MISMATCH: [409, "확인 금액이 주문금액과 다릅니다. 내역을 다시 확인하거나, 사유를 입력하고 강제 확인하세요."],
  EXPIRED_NEEDS_REVIEW: [409, "결제 기한이 만료된 주문입니다. 재고·한도 재검토 후 사유를 입력하고 강제 확인하세요."],
  CAMPAIGN_CAPACITY: [409, "캠페인 판매 가능 수량을 초과합니다. 캠페인 수량을 조정한 뒤 다시 시도하세요."],
  STOCK_RECHECK_FAILED: [409, "재고가 부족해 결제 확인을 할 수 없습니다. 재고를 확인하세요."],
};

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const staff = await getStaff();
  if (!staff || !["super_admin", "order_admin"].includes(staff.role)) {
    return NextResponse.json({ code: "FORBIDDEN", message: "결제 확인 권한이 없습니다." }, { status: 403 });
  }

  const { orderNumber } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION", message: "입력값을 확인해주세요." }, { status: 400 });
  }
  const b = parsed.data;
  if (b.force && b.memo.length < 2) {
    return NextResponse.json({ code: "MEMO_REQUIRED", message: "강제 확인 시 사유(메모)를 입력해주세요." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await db.rpc("confirm_payment", {
    p_order_id: order.id,
    p_admin_id: staff.id,
    p_confirmed_amount: b.confirmedAmount,
    p_provider: b.providerName || null,
    p_tx_id: b.txId || null,
    p_memo: b.memo || null,
    p_force: b.force,
  });

  if (error) {
    const code = error.message.split(":")[0].trim();
    const [status, message] = ERRORS[code] ?? [500, "결제 확인 중 오류가 발생했습니다."];
    if (status === 500) console.error("confirm_payment 실패", error);
    return NextResponse.json({ code, message }, { status });
  }

  return NextResponse.json({ ok: true });
}