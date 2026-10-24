import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/staff";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { formatDate } from "@/lib/format";

const STATUSES = Object.keys(ORDER_STATUS_LABEL);
const ELEVATOR: Record<string, string> = { yes: "있음", no: "없음", unknown: "잘 모름" };

type Row = {
  order_number: string; created_at: string; status: string; quantity: number; grand_total: number;
  buyer_name: string; buyer_phone: string; buyer_email: string | null;
  recipient_name: string; recipient_phone: string; zipcode: string; address1: string; address2: string | null;
  delivery_memo: string | null; user_id: string | null; quote_required: boolean;
  installation_info: { wish_date?: string | null; elevator?: string; floor?: string; pickup_old?: boolean; environment?: string; memo?: string };
  campaign_snapshot: { campaign_name: string; package_name: string; brand: string };
  order_items: {
    item_label: string; model_name: string; model_code: string; sku_code: string; quantity: number;
    attributes: Record<string, string>; addons: { group: string; label: string; price: number }[];
  }[];
  payment_records: {
    status: string; confirmed_amount: number | null; external_transaction_id: string | null;
    verified_at: string | null; created_at: string;
  }[];
};

/** CSV 셀: 따옴표 이스케이프 + 수식 실행 방지 */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function kstDayStart(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+09:00`).toISOString() : null;
}

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !["super_admin", "order_admin"].includes(staff.role)) {
    return new Response("권한이 없습니다.", { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50).replace(/[%_,()]/g, "");
  const from = kstDayStart(url.searchParams.get("from") ?? "");
  const toDay = kstDayStart(url.searchParams.get("to") ?? "");
  const to = toDay ? new Date(new Date(toDay).getTime() + 86400_000).toISOString() : null;

  let query = createAdminClient()
    .from("orders")
    .select(
      `order_number, created_at, status, quantity, grand_total, buyer_name, buyer_phone, buyer_email,
       recipient_name, recipient_phone, zipcode, address1, address2, delivery_memo, user_id, quote_required,
       installation_info, campaign_snapshot,
       order_items(item_label, model_name, model_code, sku_code, quantity, attributes, addons),
       payment_records(status, confirmed_amount, external_transaction_id, verified_at, created_at)`
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (STATUSES.includes(status)) query = query.eq("status", status);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  if (q) {
    if (/^(DT-|\d{6}-)/i.test(q)) query = query.ilike("order_number", `%${q.toUpperCase()}%`);
    else if (/^[0-9-]+$/.test(q)) query = query.ilike("buyer_phone", `%${q}%`);
    else query = query.ilike("buyer_name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return new Response(`조회 실패: ${error.message}`, { status: 500 });
  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "주문번호", "주문일시", "주문상태", "회원구분", "브랜드", "캠페인", "패키지", "세트수", "주문금액",
    "구성품(모델/SKU/옵션)", "현장견적포함",
    "주문자", "주문자휴대폰", "이메일", "수령인", "수령인연락처", "우편번호", "주소", "상세주소", "배송요청",
    "설치희망일", "엘리베이터", "층수", "기존제품수거", "설치환경", "설치요청",
    "결제상태", "결제확인금액", "외부거래번호", "결제확인일시",
  ];

  const lines = rows.map((o) => {
    const pr = [...o.payment_records].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const inst = o.installation_info ?? {};
    const items = o.order_items
      .map((i) => {
        const attrs = Object.entries(i.attributes).map(([k, v]) => `${k} ${v}`).join(", ");
        const addons = i.addons.map((a) => a.label).join(", ");
        return `${i.item_label}: ${i.model_name}(${i.model_code}) / ${i.sku_code}${attrs ? ` / ${attrs}` : ""}${addons ? ` / ${addons}` : ""} x${i.quantity}`;
      })
      .join(" | ");

    return [
      o.order_number,
      formatDate(o.created_at),
      ORDER_STATUS_LABEL[o.status] ?? o.status,
      o.user_id ? "회원" : "비회원",
      o.campaign_snapshot?.brand,
      o.campaign_snapshot?.campaign_name,
      o.campaign_snapshot?.package_name,
      o.quantity,
      o.grand_total,
      items,
      o.quote_required ? "Y" : "",
      o.buyer_name,
      o.buyer_phone,
      o.buyer_email,
      o.recipient_name,
      o.recipient_phone,
      o.zipcode,
      o.address1,
      o.address2,
      o.delivery_memo,
      inst.wish_date ?? "",
      inst.elevator ? ELEVATOR[inst.elevator] : "",
      inst.floor,
      inst.pickup_old === undefined ? "" : inst.pickup_old ? "요청" : "",
      inst.environment,
      inst.memo,
      pr ? PAYMENT_STATUS_LABEL[pr.status] ?? pr.status : "",
      pr?.confirmed_amount ?? "",
      pr?.external_transaction_id,
      pr?.verified_at ? formatDate(pr.verified_at) : "",
    ]
      .map(cell)
      .join(",");
  });

  // 개인정보 다운로드 기록
  await createAdminClient().from("admin_activity_logs").insert({
    admin_id: staff.id,
    action: "export_orders_csv",
    target_type: "order",
    target_id: "export",
    detail: { count: rows.length, status, q, from: url.searchParams.get("from"), to: url.searchParams.get("to") },
  });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, "");
  const csv = "\uFEFF" + [header.map(cell).join(","), ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders_${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}