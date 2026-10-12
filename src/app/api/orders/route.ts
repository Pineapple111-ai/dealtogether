import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getCampaignDetail } from "@/lib/queries/campaign-detail";
import { computeQuote, decodeSelection } from "@/lib/pricing";
import { orderRequestSchema } from "@/lib/checkout-schema";
import { resolvePaymentUrl } from "@/lib/payment";
import { phoneDigits } from "@/lib/phone";

const RPC_ERRORS: Record<string, string> = {
  CAMPAIGN_NOT_FOUND: "공동구매 정보를 찾을 수 없습니다.",
  CAMPAIGN_CLOSED: "공동구매가 마감되어 주문할 수 없습니다.",
  CAMPAIGN_SOLD_OUT: "잔여 수량이 부족합니다. 수량을 줄이거나 다른 공동구매를 확인해주세요.",
  PER_USER_LIMIT: "1인 구매 한도를 초과했습니다. 결제 대기 중인 주문도 한도에 포함됩니다.",
  OUT_OF_STOCK: "선택한 옵션의 재고가 방금 소진되었습니다. 옵션을 다시 선택해주세요.",
  SKU_NOT_FOUND: "선택한 옵션을 찾을 수 없습니다. 옵션을 다시 선택해주세요.",
};

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, message, ...extra }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "VALIDATION", parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }
  const { campaignSlug, selection, idempotencyKey, expectedTotal, form } = parsed.data;

  const admin = createAdminClient();

  // 1. 공동구매·옵션·가격 서버 재검증
  const detail = await getCampaignDetail(campaignSlug, admin);
  if (!detail) return fail(404, "NOT_FOUND", "공동구매 정보를 찾을 수 없습니다.");

  const sel = decodeSelection(selection);
  if (!sel) return fail(400, "BAD_SELECTION", "선택 정보가 올바르지 않습니다. 옵션을 다시 선택해주세요.");

  const { ok, errors, quote } = computeQuote(detail, sel);
  if (!ok) return fail(409, "INVALID_SELECTION", errors[0], { errors });

  if (quote.grandTotal !== expectedTotal) {
    return fail(409, "PRICE_CHANGED", "주문 금액이 변경되었습니다.", { newTotal: quote.grandTotal });
  }

  // 2. 결제 링크 확인 (없으면 주문 차단)
  const [{ data: payRow }, { data: site }] = await Promise.all([
    admin
      .from("campaigns")
      .select("payment_url, package:packages!inner(brand:brands!inner(payment_url))")
      .eq("id", detail.campaign.id)
      .single(),
    admin
      .from("site_settings")
      .select("default_payment_url, payment_provider_name, allowed_payment_domains")
      .eq("id", 1)
      .single(),
  ]);
  const pr = payRow as unknown as { payment_url: string | null; package: { brand: { payment_url: string | null } } } | null;
  const paymentUrl = resolvePaymentUrl(
    pr?.payment_url ?? null,
    pr?.package.brand.payment_url ?? null,
    site?.default_payment_url ?? null,
    site?.allowed_payment_domains ?? []
  );
  if (!paymentUrl) {
    return fail(503, "PAYMENT_NOT_CONFIGURED", "결제 설정이 완료되지 않아 주문을 진행할 수 없습니다. 고객센터로 문의해주세요.");
  }

  // 3. 회원 여부 (비회원은 휴대폰번호로 참여자 식별)
  let userId: string | null = null;
  try {
    const sb = await createSessionClient();
    const { data } = await sb.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  const participantKey = userId ? `u:${userId}` : `p:${phoneDigits(form.buyerPhone)}`;

  const c = detail.campaign;
  const payload = {
    idempotency_key: idempotencyKey,
    user_id: userId,
    participant_key: participantKey,
    campaign_id: c.id,
    quantity: quote.quantity,
    base_price: quote.basePrice,
    option_total: quote.optionTotal,
    optional_item_total: quote.optionalItemTotal,
    installation_fee: quote.installationFee,
    shipping_fee: quote.shippingFee,
    discount_total: quote.discountTotal,
    grand_total: quote.grandTotal,
    buyer_name: form.buyerName,
    buyer_phone: form.buyerPhone,
    buyer_email: form.buyerEmail,
    recipient_name: form.recipientName,
    recipient_phone: form.recipientPhone,
    zipcode: form.zipcode,
    address1: form.address1,
    address2: form.address2,
    delivery_memo: form.deliveryMemo,
    installation_info: form.installation
      ? {
          wish_date: form.installation.wishDate || null,
          elevator: form.installation.elevator,
          floor: form.installation.floor,
          pickup_old: form.installation.pickupOld,
          environment: form.installation.environment,
          memo: form.installation.memo,
        }
      : {},
    campaign_snapshot: {
      campaign_id: c.id,
      campaign_name: c.name,
      campaign_slug: c.slug,
      package_id: c.package.id,
      package_name: c.package.name,
      brand: c.package.brand.name,
      category: c.package.category.name,
      campaign_price: c.campaignPrice,
      list_price: c.listPrice,
      start_at: c.startAt,
      end_at: c.endAt,
      target_participants: c.targetParticipants,
    },
    payment_url: paymentUrl,
    provider_name: site?.payment_provider_name ?? null,
    quote_required: quote.quoteRequired,
    items: quote.lines.map((l) => ({
      package_item_id: l.packageItemId,
      sku_id: l.skuId,
      is_optional: l.isOptional,
      item_label: l.itemLabel,
      product_name: l.productName,
      model_code: l.modelCode,
      model_name: l.modelName,
      sku_code: l.skuCode,
      attributes: l.attributes,
      addons: l.addons,
      quantity: l.quantity,
      item_price: l.itemPrice,
      sku_adjustment: l.skuAdjustment,
      addon_total: l.addonTotal,
    })),
  };

  // 4. 주문 생성 + 재고 예약 (DB 트랜잭션)
  const { data, error } = await admin.rpc("create_order", { p: payload });
  if (error) {
    const code = error.message.split(":")[0].trim();
    const msg = RPC_ERRORS[code];
    if (msg) return fail(409, code, msg);
    console.error("create_order 실패", error);
    return fail(500, "ORDER_FAILED", "주문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }

  const result = data as { order_id: string; order_number: string };
  const { data: tokenRow } = await admin
    .from("orders")
    .select("access_token")
    .eq("id", result.order_id)
    .single();

  return NextResponse.json({
    orderNumber: result.order_number,
    token: tokenRow?.access_token,
  });
}