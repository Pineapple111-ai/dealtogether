import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getStoreProductsByIds, getActiveDiscountRules } from "@/lib/queries/store";
import { computeStoreQuote } from "@/lib/store-pricing";
import { checkoutSchema } from "@/lib/checkout-schema";
import { isAllowedPaymentUrl } from "@/lib/payment";
import { phoneDigits } from "@/lib/phone";
import { STORE_CATEGORY_LABEL } from "@/lib/store";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        productId: z.string().uuid(),
        skuId: z.string().uuid(),
        addons: z.record(z.string(), z.array(z.string().uuid()).max(10)),
        quantity: z.number().int().min(1).max(10),
      })
    )
    .min(1)
    .max(50),
  idempotencyKey: z.string().uuid(),
  expectedTotal: z.number().int().nonnegative(),
  form: checkoutSchema,
});

const RPC_ERRORS: Record<string, string> = {
  OUT_OF_STOCK: "담은 상품의 재고가 방금 소진되었습니다. 장바구니를 확인해주세요.",
  SKU_NOT_FOUND: "판매가 종료된 상품이 있습니다. 장바구니를 확인해주세요.",
};

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, message, ...extra }, { status });
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  const { items, idempotencyKey, expectedTotal, form } = parsed.data;

  const admin = createAdminClient();

  // 1. 최신 가격·재고·할인으로 재계산
  const [products, rules, { data: site }] = await Promise.all([
    getStoreProductsByIds([...new Set(items.map((i) => i.productId))], admin),
    getActiveDiscountRules(admin),
    admin.from("site_settings").select("bundle_max_rate, default_payment_url, payment_provider_name, allowed_payment_domains").eq("id", 1).single(),
  ]);
  const quote = computeStoreQuote(products, items, rules, Number(site?.bundle_max_rate ?? 10));
  if (!quote.ok) {
    const first = quote.lines.find((l) => l.error);
    return fail(409, "INVALID_CART", first ? `${first.productName}: ${first.error}` : "장바구니를 확인해주세요.");
  }
  if (quote.grandTotal !== expectedTotal) {
    return fail(409, "PRICE_CHANGED", "주문 금액이 변경되었습니다.", { newTotal: quote.grandTotal });
  }

  // 2. 결제 링크 (일반 주문은 공통 링크)
  const paymentUrl = site?.default_payment_url?.trim();
  if (!paymentUrl || !isAllowedPaymentUrl(paymentUrl, site?.allowed_payment_domains ?? [])) {
    return fail(503, "PAYMENT_NOT_CONFIGURED", "결제 설정이 완료되지 않아 주문을 진행할 수 없습니다. 고객센터로 문의해주세요.");
  }

  // 3. 회원 여부
  let userId: string | null = null;
  try {
    const { data } = await (await createSessionClient()).auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  const brands = [...new Set(quote.lines.map((l) => l.brand))];
  const first = quote.lines[0];
  const title = quote.lines.length > 1 ? `${first.productName} 외 ${quote.lines.length - 1}건` : first.productName;
  const units = quote.lines.reduce((s, l) => s + l.quantity, 0);

  const payload = {
    idempotency_key: idempotencyKey,
    user_id: userId,
    participant_key: userId ? `u:${userId}` : `p:${phoneDigits(form.buyerPhone)}`,
    quantity: units,
    base_price: quote.goodsTotal,
    installation_fee: quote.addonTotal,
    shipping_fee: quote.shippingFee,
    discount_total: quote.discount,
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
      type: "store",
      campaign_name: "가전 쇼핑",
      package_name: title,
      brand: brands.join(" · "),
      discount: { rate: quote.rate, raw_rate: quote.rawRate, rules: quote.appliedRules, eligible_amount: quote.eligibleAmount },
    },
    payment_url: paymentUrl,
    provider_name: site?.payment_provider_name ?? null,
    quote_required: quote.quoteRequired,
    items: quote.lines.map((l) => ({
      sku_id: l.skuId,
      item_label: `${STORE_CATEGORY_LABEL[l.category] ?? ""} ${l.productType}`.trim(),
      product_name: l.productName,
      model_code: l.modelCode,
      model_name: l.modelName,
      sku_code: l.skuCode,
      attributes: l.attributes,
      addons: l.addons,
      quantity: l.quantity,
      item_price: l.unitPrice,
      addon_total: l.addonUnit,
    })),
  };

  const { data, error } = await admin.rpc("create_store_order", { p: payload });
  if (error) {
    const code = error.message.split(":")[0].trim();
    if (RPC_ERRORS[code]) return fail(409, code, RPC_ERRORS[code]);
    console.error("create_store_order 실패", error);
    return fail(500, "ORDER_FAILED", "주문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }

  const result = data as { order_id: string; order_number: string };
  const { data: tokenRow } = await admin.from("orders").select("access_token").eq("id", result.order_id).single();
  return NextResponse.json({ orderNumber: result.order_number, token: tokenRow?.access_token });
}