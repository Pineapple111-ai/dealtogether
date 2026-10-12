import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { won, formatDate } from "@/lib/format";
import ConfirmPaymentForm from "@/components/admin/ConfirmPaymentForm";
import OrderStatusActions from "@/components/admin/OrderStatusActions";

type Params = { params: Promise<{ orderNumber: string }> };

type Detail = {
  id: string;
  order_number: string;
  user_id: string | null;
  status: string;
  quantity: number;
  base_price: number;
  option_total: number;
  optional_item_total: number;
  installation_fee: number;
  shipping_fee: number;
  discount_total: number;
  grand_total: number;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string | null;
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
  delivery_memo: string | null;
  installation_info: {
    wish_date?: string | null;
    elevator?: string;
    floor?: string;
    pickup_old?: boolean;
    environment?: string;
    memo?: string;
  };
  campaign_snapshot: { campaign_name: string; package_name: string; brand: string; campaign_slug?: string };
  payment_url_snapshot: string | null;
  quote_required: boolean;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  order_items: {
    id: string;
    item_label: string;
    model_name: string;
    model_code: string;
    sku_code: string;
    attributes: Record<string, string>;
    addons: { group: string; label: string; price: number }[];
    quantity: number;
    is_optional: boolean;
    item_price: number;
    sku_adjustment: number;
    addon_total: number;
  }[];
  payment_records: {
    id: string;
    provider_name: string | null;
    external_transaction_id: string | null;
    expected_amount: number;
    confirmed_amount: number | null;
    status: string;
    amount_mismatch: boolean;
    redirected_at: string | null;
    verified_at: string | null;
    verified_by: string | null;
    memo: string | null;
    created_at: string;
  }[];
  order_status_history: {
    id: number;
    previous_status: string | null;
    new_status: string;
    changed_by: string | null;
    reason: string | null;
    created_at: string;
  }[];
};

const ELEVATOR: Record<string, string> = { yes: "있음", no: "없음", unknown: "잘 모름" };

export default function AdminOrderDetailPage({ params }: Params) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white p-5 ${className}`}>
      <h2 className="mb-4 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-sub">{k}</dt>
          <dd className="break-all">{v || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

async function OrderDetail({ params }: Params) {
  await connection();
  const staff = await requireStaff("orders");
  const canEdit = ["super_admin", "order_admin"].includes(staff.role);
  const { orderNumber } = await params;

  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("*, order_items(*), payment_records(*), order_status_history(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!data) notFound();
  const o = data as unknown as Detail;

  // 처리 담당자 이름
  const actorIds = [
    ...o.payment_records.map((p) => p.verified_by),
    ...o.order_status_history.map((h) => h.changed_by),
  ].filter((x): x is string => !!x);
  const { data: actors } = actorIds.length
    ? await db.from("profiles").select("id, name, email").in("id", [...new Set(actorIds)])
    : { data: [] as { id: string; name: string | null; email: string | null }[] };
  const actorName = (id: string | null) => {
    if (!id) return "시스템/고객";
    const a = actors?.find((x) => x.id === id);
    return a?.name ?? a?.email ?? "관리자";
  };

  const { data: site } = await db.from("site_settings").select("payment_provider_name").eq("id", 1).single();

  const now = Date.now();
  const expiredByTime =
    (o.status === "pending_payment" || o.status === "payment_verification") && new Date(o.expires_at).getTime() <= now;
  const confirmable = ["pending_payment", "payment_verification", "expired"].includes(o.status);
  const payments = [...o.payment_records].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const history = [...o.order_status_history].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const inst = o.installation_info ?? {};

  const priceRows: [string, number][] = [
    [`공동구매가 × ${o.quantity}`, o.base_price],
    ["옵션 추가 금액", o.option_total],
    ["선택 구성품", o.optional_item_total],
    ["설치·부가 옵션", o.installation_fee],
    ["배송비", o.shipping_fee],
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/orders" className="text-sm text-sub hover:text-ink">← 주문 목록</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="tabular text-2xl font-extrabold">{o.order_number}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${o.status === "paid" ? "bg-navy text-white" : "bg-white"}`}>
            {ORDER_STATUS_LABEL[o.status] ?? o.status}
          </span>
          {expiredByTime && <span className="rounded-full bg-coral/10 px-3 py-1 text-sm font-bold text-coral">결제 기한 지남</span>}
          {o.quote_required && <span className="rounded-full bg-white px-3 py-1 text-sm">현장 견적 포함</span>}
        </div>
        <p className="tabular mt-1 text-sm text-sub">
          주문 {formatDate(o.created_at)} · 결제 기한 {formatDate(o.expires_at)}
          {o.paid_at && ` · 결제 확인 ${formatDate(o.paid_at)}`} · {o.user_id ? "회원 주문" : "비회원 주문"}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Card title={`주문 상품 — ${o.campaign_snapshot.package_name}`}>
            <p className="-mt-2 mb-4 text-[13px] text-sub">
              {o.campaign_snapshot.brand} · {o.campaign_snapshot.campaign_name}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-line text-left text-[13px] text-sub">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">구성품</th>
                    <th className="py-2 pr-3 font-semibold">모델 / SKU</th>
                    <th className="py-2 pr-3 font-semibold">옵션</th>
                    <th className="py-2 pr-3 text-right font-semibold">수량</th>
                    <th className="py-2 text-right font-semibold">단위 추가금</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {o.order_items.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="py-3 pr-3 font-semibold">
                        {i.item_label}
                        {i.is_optional && <span className="block text-xs font-normal text-sub">선택 구성품</span>}
                      </td>
                      <td className="py-3 pr-3">
                        {i.model_name}
                        <span className="block text-xs text-sub">{i.model_code} / {i.sku_code}</span>
                      </td>
                      <td className="py-3 pr-3 text-[13px]">
                        {Object.entries(i.attributes).map(([k, v]) => `${k} ${v}`).join(", ")}
                        {i.addons.map((a) => (
                          <span key={a.group + a.label} className="block text-sub">
                            {a.group}: {a.label} {a.price > 0 && `(+${won(a.price)})`}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 pr-3 text-right">{i.quantity}</td>
                      <td className="py-3 text-right text-[13px]">
                        {i.item_price > 0 && <span className="block">구성품 {won(i.item_price)}</span>}
                        {i.sku_adjustment > 0 && <span className="block">모델 +{won(i.sku_adjustment)}</span>}
                        {i.addon_total > 0 && <span className="block">옵션 +{won(i.addon_total)}</span>}
                        {i.item_price + i.sku_adjustment + i.addon_total === 0 && "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="tabular mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              {priceRows.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-sub">{k}</dt>
                  <dd>{won(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
                <dt>주문금액</dt>
                <dd className="text-navy">{won(o.grand_total)}</dd>
              </div>
            </dl>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="주문자 · 배송지">
              <Rows
                rows={[
                  ["주문자", o.buyer_name],
                  ["휴대폰", o.buyer_phone],
                  ["이메일", o.buyer_email],
                  ["수령인", o.recipient_name],
                  ["수령인 연락처", o.recipient_phone],
                  ["주소", `(${o.zipcode}) ${o.address1} ${o.address2 ?? ""}`],
                  ["배송 요청", o.delivery_memo],
                ]}
              />
            </Card>
            <Card title="설치 정보">
              <Rows
                rows={[
                  ["희망일", inst.wish_date ? `${inst.wish_date} (희망)` : ""],
                  ["엘리베이터", inst.elevator ? ELEVATOR[inst.elevator] : ""],
                  ["층수", inst.floor],
                  ["기존 제품 수거", inst.pickup_old === undefined ? "" : inst.pickup_old ? "요청" : "없음"],
                  ["설치 환경", inst.environment],
                  ["요청사항", inst.memo],
                ]}
              />
            </Card>
          </div>

          <Card title="상태 변경 이력">
            <ol className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="tabular w-36 shrink-0 text-sub">{formatDate(h.created_at)}</span>
                  <span>
                    {h.previous_status ? `${ORDER_STATUS_LABEL[h.previous_status] ?? h.previous_status} → ` : ""}
                    <b>{ORDER_STATUS_LABEL[h.new_status] ?? h.new_status}</b>
                    <span className="text-sub"> · {actorName(h.changed_by)}</span>
                    {h.reason && <span className="block text-[13px] text-sub">{h.reason}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="결제 기록">
            <ul className="space-y-4 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="rounded-lg bg-soft p-3">
                  <div className="flex items-center justify-between">
                    <b>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</b>
                    {p.amount_mismatch && <span className="text-xs font-bold text-coral">금액 불일치</span>}
                  </div>
                  <dl className="tabular mt-2 grid grid-cols-[90px_1fr] gap-y-1 text-[13px]">
                    <dt className="text-sub">결제 예정</dt><dd>{won(p.expected_amount)}</dd>
                    <dt className="text-sub">확인 금액</dt><dd>{p.confirmed_amount !== null ? won(p.confirmed_amount) : "-"}</dd>
                    <dt className="text-sub">결제 서비스</dt><dd>{p.provider_name ?? "-"}</dd>
                    <dt className="text-sub">거래번호</dt><dd className="break-all">{p.external_transaction_id ?? "-"}</dd>
                    <dt className="text-sub">결제창 이동</dt><dd>{p.redirected_at ? formatDate(p.redirected_at) : "이동 기록 없음"}</dd>
                    <dt className="text-sub">확인 일시</dt><dd>{p.verified_at ? formatDate(p.verified_at) : "-"}</dd>
                    <dt className="text-sub">확인 담당</dt><dd>{p.verified_by ? actorName(p.verified_by) : "-"}</dd>
                    {p.memo && (<><dt className="text-sub">메모</dt><dd>{p.memo}</dd></>)}
                  </dl>
                </li>
              ))}
            </ul>
            {o.payment_url_snapshot && (
              <p className="mt-3 break-all text-xs text-sub">주문 시 결제 링크: {o.payment_url_snapshot}</p>
            )}
          </Card>

          {confirmable && (
            <Card title="결제 확인" className="ring-2 ring-navy/20">
              <p className="mb-4 text-[13px] leading-relaxed text-sub">
                외부 결제 업체 관리 화면에서 주문번호 <b className="text-ink">{o.order_number}</b>, 금액{" "}
                <b className="text-ink">{won(o.grand_total)}</b> 입금을 확인한 뒤 처리하세요.
              </p>
              <ConfirmPaymentForm
                orderNumber={o.order_number}
                expectedAmount={o.grand_total}
                defaultProvider={payments[0]?.provider_name ?? site?.payment_provider_name ?? ""}
                canEdit={canEdit}
              />
            </Card>
          )}

          <Card title="주문 상태 변경">
            <OrderStatusActions orderNumber={o.order_number} status={o.status} canEdit={canEdit} />
          </Card>
        </div>
      </div>
    </div>
  );
}