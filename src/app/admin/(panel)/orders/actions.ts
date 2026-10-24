"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/staff";
import { fromKstInput } from "@/lib/admin/datetime";
import type { ActionResult } from "@/lib/admin/action-result";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveShipment(fd: FormData): Promise<ActionResult> {
  const staff = await getStaff();
  if (!staff || !["super_admin", "order_admin"].includes(staff.role)) {
    return { ok: false, error: "배송·설치 정보를 저장할 권한이 없습니다." };
  }

  const orderId = s(fd, "order_id");
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, error: "잘못된 요청입니다." };

  const phone = s(fd, "technician_phone");
  if (phone && !/^010-\d{4}-\d{4}$/.test(phone)) return { ok: false, error: "담당자 연락처는 010-0000-0000 형식으로 입력해주세요." };

  const deliveryDate = s(fd, "delivery_date");
  if (deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return { ok: false, error: "배송 예정일을 확인해주세요." };

  const installRaw = s(fd, "install_at");
  const installedRaw = s(fd, "installed_at");
  const installAt = installRaw ? fromKstInput(installRaw) : null;
  const installedAt = installedRaw ? fromKstInput(installedRaw) : null;
  if (installRaw && !installAt) return { ok: false, error: "설치 예정 일시를 확인해주세요." };
  if (installedRaw && !installedAt) return { ok: false, error: "설치 완료 일시를 확인해주세요." };

  const fields = {
    order_id: orderId,
    carrier: s(fd, "carrier").slice(0, 50) || null,
    tracking_number: s(fd, "tracking_number").replace(/\s/g, "").slice(0, 50) || null,
    delivery_date: deliveryDate || null,
    installer: s(fd, "installer").slice(0, 50) || null,
    technician: s(fd, "technician").slice(0, 30) || null,
    technician_phone: phone || null,
    install_at: installAt,
    installed_at: installedAt,
    customer_note: s(fd, "customer_note").slice(0, 500) || null,
    admin_memo: s(fd, "admin_memo").slice(0, 1000) || null,
    updated_by: staff.id,
  };

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("order_number").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, error: "주문을 찾을 수 없습니다." };

  const { error } = await db.from("shipments").upsert(fields, { onConflict: "order_id" });
  if (error) {
    console.error("배송 정보 저장 실패", error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }

  await db.from("admin_activity_logs").insert({
    admin_id: staff.id, action: "save_shipment", target_type: "order", target_id: order.order_number,
    detail: { carrier: fields.carrier, tracking: fields.tracking_number, install_at: fields.install_at },
  });
  revalidatePath(`/admin/orders/${order.order_number}`);
  return { ok: true, message: "저장되었습니다. 필요하면 아래에서 주문 상태도 변경해주세요." };
}