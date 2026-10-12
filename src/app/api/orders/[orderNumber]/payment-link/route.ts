import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccessibleOrder } from "@/lib/queries/order-access";
import { isAwaitingPayment } from "@/lib/order-status";
import { resolvePaymentUrl } from "@/lib/payment";

type Ctx = { params: Promise<{ orderNumber: string }> };

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(req: Request, { params }: Ctx) {
  const { orderNumber } = await params;
  let token: string | null = null;
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : null;
  } catch {
    /* 회원은 토큰 없이 가능 */
  }

  const order = await findAccessibleOrder(orderNumber, token);
  if (!order) return fail(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");

  if (!isAwaitingPayment(order.status, order.expires_at)) {
    return fail(409, "NOT_PAYABLE", "결제 대기 중인 주문이 아닙니다. 주문 상태를 확인해주세요.");
  }

  // 현재 결제 링크 재확인 (관리자가 변경했을 수 있음)
  const admin = createAdminClient();
  const [{ data: payRow }, { data: site }] = await Promise.all([
    admin
      .from("campaigns")
      .select("payment_url, package:packages!inner(brand:brands!inner(payment_url))")
      .eq("id", order.campaign_id)
      .single(),
    admin
      .from("site_settings")
      .select("default_payment_url, allowed_payment_domains")
      .eq("id", 1)
      .single(),
  ]);
  const pr = payRow as unknown as { payment_url: string | null; package: { brand: { payment_url: string | null } } } | null;
  const url = resolvePaymentUrl(
    pr?.payment_url ?? null,
    pr?.package.brand.payment_url ?? null,
    site?.default_payment_url ?? null,
    site?.allowed_payment_domains ?? []
  );
  if (!url) {
    return fail(503, "PAYMENT_NOT_CONFIGURED", "결제 링크가 설정되지 않았습니다. 고객센터로 문의해주세요.");
  }

  // 이동 기록 (결제 완료 아님). 개인정보는 URL에 넣지 않음
  const { error: markError } = await admin.rpc("mark_payment_redirected", { p_order_id: order.id });
  if (markError) {
    console.error("mark_payment_redirected 실패", markError);
    return fail(500, "MARK_FAILED", `결제 이동 기록 실패: ${markError.message}`);
  }

  return NextResponse.json({ url });
}