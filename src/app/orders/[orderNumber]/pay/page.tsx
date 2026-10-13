import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccessibleOrder } from "@/lib/queries/order-access";
import { ORDER_STATUS_LABEL, isAwaitingPayment } from "@/lib/order-status";
import { won, formatDate } from "@/lib/format";
import PaymentRedirectButton from "@/components/checkout/PaymentRedirectButton";
import CancelOrderButton from "@/components/checkout/CancelOrderButton";

export const metadata: Metadata = { title: "안전결제 진행", robots: { index: false } };

type Props = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
};

export default function PayPage(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 pt-10" />}>
      <PayView {...props} />
    </Suspense>
  );
}

async function PayView({ params, searchParams }: Props) {
  await connection();
  const [{ orderNumber }, { t }] = await Promise.all([params, searchParams]);
  const order = await findAccessibleOrder(orderNumber, t ?? null);

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold">주문을 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm text-sub">링크가 올바른지 확인하거나 비회원 주문조회를 이용해주세요.</p>
        <Link href="/order-lookup" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
          비회원 주문조회
        </Link>
      </div>
    );
  }

  const { data: site } = await createAdminClient()
    .from("site_settings")
    .select("payment_notice, payment_provider_name")
    .eq("id", 1)
    .single();

  const awaiting = isAwaitingPayment(order.status, order.expires_at);
  const statusLabel =
    !awaiting && (order.status === "pending_payment" || order.status === "payment_verification")
      ? ORDER_STATUS_LABEL.expired
      : ORDER_STATUS_LABEL[order.status] ?? order.status;
  const snap = order.campaign_snapshot;

  const isStore = (order as unknown as { order_type?: string }).order_type === "store";
  const rows: [string, number][] = isStore
    ? [
        ["상품 금액", order.base_price],
        ["설치·부가 옵션", order.installation_fee],
        ["배송비", order.shipping_fee],
      ]
    : [
        [`공동구매가 × ${order.quantity}`, order.base_price],
        ["옵션 추가 금액", order.option_total],
        ["선택 구성품", order.optional_item_total],
        ["설치·부가 옵션", order.installation_fee],
        ["배송비", order.shipping_fee],
      ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      {awaiting ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto text-navy" size={44} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">주문이 접수되었습니다</h1>
          <p className="mt-2 text-sm text-sub">안전결제 페이지에서 결제를 진행해주세요.</p>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">{statusLabel}</h1>
          <p className="mt-2 text-sm text-sub">
            {order.status === "paid" || order.status === "preparing"
              ? "결제가 확인되었습니다. 배송·설치 일정은 별도로 안내드립니다."
              : "이 주문은 현재 결제를 진행할 수 없습니다."}
          </p>
        </div>
      )}

      {/* 주문번호 + 결제 예정금액 */}
      <section className="mt-8 rounded-xl bg-navy p-6 text-white">
        <dl className="tabular grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-white/60">주문번호</dt>
            <dd className="mt-1 select-all text-xl font-bold tracking-wide">{order.order_number}</dd>
          </div>
          <div className="sm:text-right">
            <dt className="text-[13px] text-white/60">최종 결제 예정금액</dt>
            <dd className="mt-1 text-2xl font-extrabold">{won(order.grand_total)}</dd>
          </div>
        </dl>
        {awaiting && (
          <p className="mt-4 border-t border-white/15 pt-4 text-[13px] leading-relaxed text-white/75">
            결제 페이지에서 주문번호와 금액이 필요할 수 있으니 확인해두세요.
            <br />
            결제 대기 기한: <b className="text-white">{formatDate(order.expires_at)}</b>
          </p>
        )}
      </section>

      {/* 주문 상품 */}
      <section className="mt-6 rounded-xl border border-line p-5">
        <p className="text-[13px] font-bold text-sub">{snap.brand}</p>
        <h2 className="mt-0.5 text-lg font-bold">{snap.package_name}</h2>
        <ul className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          {order.order_items.map((i) => (
            <li key={i.id}>
              <p className="font-semibold">
                {i.item_label}
                {i.is_optional && <span className="ml-1 text-xs font-normal text-sub">(선택)</span>}
                <span className="tabular ml-1 font-normal text-sub">× {i.quantity}</span>
              </p>
              <p className="text-[13px] text-sub">
                {i.model_name} ({i.model_code})
              </p>
              <p className="text-[13px] text-sub">
                {Object.entries(i.attributes).map(([k, v]) => `${k} ${v}`).join(", ")}
                {i.addons.length > 0 && ` · ${i.addons.map((a) => a.label).join(", ")}`}
              </p>
            </li>
          ))}
        </ul>

        <dl className="tabular mt-4 space-y-2 border-t border-line pt-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-sub">{k}</dt>
              <dd>{v > 0 ? won(v) : k === "배송비" ? "무료" : "0원"}</dd>
            </div>
          ))}
          {order.discount_total > 0 && (
            <div className="flex justify-between font-semibold text-coral">
              <dt>세트 할인</dt>
              <dd>-{won(order.discount_total)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>최종 결제 예정금액</dt>
            <dd className="text-navy">{won(order.grand_total)}</dd>
          </div>
        </dl>
        {order.quote_required && (
          <p className="mt-3 text-xs text-sub">현장 견적 옵션이 포함되어 설치 시 추가 비용이 발생할 수 있습니다.</p>
        )}
      </section>

      {awaiting && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl bg-soft p-5 text-sm leading-relaxed text-ink/80">
            {site?.payment_provider_name && (
              <p className="mb-1 font-bold text-ink">결제 서비스: {site.payment_provider_name}</p>
            )}
            <p>{site?.payment_notice}</p>
            <p className="mt-2 text-xs text-sub">
              결제 페이지로 이동한 것만으로는 결제가 완료되지 않습니다. 결제 확인 후 주문 내역에 반영되며,
              그때부터 공동구매 참여 인원에 포함됩니다.
            </p>
          </div>

          <PaymentRedirectButton orderNumber={order.order_number} token={t ?? null} />

          <p className="text-center text-xs leading-relaxed text-sub">
            결제를 나중에 진행하려면 이 페이지 주소를 보관하거나,
            <br />
            비회원 주문조회(주문번호 + 휴대폰 번호)로 다시 들어올 수 있습니다.
          </p>

          <CancelOrderButton orderNumber={order.order_number} token={t ?? null} />
        </section>
      )}

      <p className="tabular mt-8 text-center text-xs text-sub">주문일시 {formatDate(order.created_at)}</p>
    </div>
  );
}