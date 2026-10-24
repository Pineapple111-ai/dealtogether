import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderItemRow = {
  id: string;
  item_label: string;
  product_name: string;
  model_code: string;
  model_name: string;
  sku_code: string;
  attributes: Record<string, string>;
  addons: { group: string; label: string; price: number }[];
  quantity: number;
  is_optional: boolean;
};

export type OrderRow = {
  id: string;
  order_number: string;
  access_token: string;
  user_id: string | null;
  campaign_id: string;
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
  recipient_name: string;
  recipient_phone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
  campaign_snapshot: { campaign_name: string; package_name: string; brand: string; campaign_slug?: string };
  quote_required: boolean;
  expires_at: string;
  created_at: string;
  order_items: OrderItemRow[];
  shipments: ShipmentRow | ShipmentRow[] | null;
};

export type ShipmentRow = {
  carrier: string | null; tracking_number: string | null; delivery_date: string | null;
  installer: string | null; technician: string | null; technician_phone: string | null;
  install_at: string | null; installed_at: string | null; customer_note: string | null;
};

/**
 * 주문 접근 확인 (서버 전용)
 * - 비회원: 주문 접근 토큰 일치
 * - 회원: 로그인 계정이 주문자
 */
export async function findAccessibleOrder(orderNumber: string, token: string | null) {
  if (!/^(\d{6}-\d{3}|DT-\d{8}-\d{6})$/.test(orderNumber)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("*, order_items(*), shipments(carrier, tracking_number, delivery_date, installer, technician, technician_phone, install_at, installed_at, customer_note)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!data) return null;

  const order = data as unknown as OrderRow;

  if (token && UUID.test(token) && token === order.access_token) return order;

  if (order.user_id) {
    try {
      const sb = await createSessionClient();
      const { data: auth } = await sb.auth.getUser();
      if (auth.user?.id === order.user_id) return order;
    } catch {
      /* 비로그인 */
    }
  }
  return null;
}