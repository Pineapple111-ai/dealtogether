"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { isAllowedPaymentUrl } from "@/lib/payment";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(/[^0-9]/g, ""));

async function log(adminId: string, action: string, detail: Record<string, unknown>) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "settings", target_id: "site", detail });
}

function done(message = "저장되었습니다."): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function parseDomains(raw: string): string[] | null {
  const list = [...new Set(raw.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean))];
  for (const d of list) {
    if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return null;
  }
  return list.slice(0, 20);
}

// ---------- 외부 결제 ----------
export async function updatePaymentSettings(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("settings");

  const domains = parseDomains(str(fd, "allowed_payment_domains"));
  if (domains === null) return { ok: false, error: "승인 도메인 형식을 확인해주세요. 예: pay.example.co.kr (https:// 없이)" };

  const url = str(fd, "default_payment_url");
  if (url && !isAllowedPaymentUrl(url, domains)) {
    return { ok: false, error: "공통 결제 링크가 https:// 주소가 아니거나 승인 도메인에 포함되지 않습니다." };
  }

  const p = z
    .object({
      payment_provider_name: z.string().max(50),
      payment_notice: z.string().min(1, "결제 안내 문구를 입력해주세요.").max(500),
      reservation_hours: z.number().int().min(1, "예약시간은 1~168시간입니다.").max(168, "예약시간은 1~168시간입니다."),
    })
    .safeParse({
      payment_provider_name: str(fd, "payment_provider_name"),
      payment_notice: str(fd, "payment_notice"),
      reservation_hours: num(fd, "reservation_hours"),
    });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  // 기존 브랜드·캠페인 결제 링크가 새 도메인 목록에 맞는지 확인
  if (domains.length) {
    const [{ data: brands }, { data: campaigns }] = await Promise.all([
      db().from("brands").select("name, payment_url").not("payment_url", "is", null),
      db().from("campaigns").select("name, payment_url").not("payment_url", "is", null).is("manual_state", null),
    ]);
    const broken = [
      ...(brands ?? []).filter((b) => !isAllowedPaymentUrl(b.payment_url!, domains)).map((b) => `브랜드 ${b.name}`),
      ...(campaigns ?? []).filter((c) => !isAllowedPaymentUrl(c.payment_url!, domains)).map((c) => `캠페인 ${c.name}`),
    ];
    if (broken.length) {
      return { ok: false, error: `승인 도메인에 맞지 않는 결제 링크가 있습니다: ${broken.slice(0, 5).join(", ")}${broken.length > 5 ? " 외" : ""}. 해당 링크를 먼저 수정하세요.` };
    }
  }

  const { error } = await db()
    .from("site_settings")
    .update({ ...p.data, default_payment_url: url || null, allowed_payment_domains: domains })
    .eq("id", 1);
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, "update_payment_settings", { default_payment_url: url, domains, reservation_hours: p.data.reservation_hours });
  return done(url ? "저장되었습니다." : "저장되었습니다. 공통 결제 링크가 비어 있어 브랜드·캠페인 링크가 없는 상품은 주문이 차단됩니다.");
}

// ---------- 브랜드별 결제 링크 ----------
export async function updateBrandPaymentUrl(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("settings");
  const id = str(fd, "id");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const url = str(fd, "payment_url");
  if (url) {
    const { data: site } = await db().from("site_settings").select("allowed_payment_domains").eq("id", 1).single();
    if (!isAllowedPaymentUrl(url, site?.allowed_payment_domains ?? [])) {
      return { ok: false, error: "https:// 주소이며 승인 도메인에 포함되어야 합니다." };
    }
  }
  const { error } = await db().from("brands").update({ payment_url: url || null }).eq("id", id);
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다." };
  await log(staff.id, "update_brand_payment_url", { brand_id: id, url });
  return done();
}

// ---------- 사업자 정보 ----------
export async function updateBusinessSettings(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("settings");

  const email = str(fd, "cs_email");
  if (email && !z.string().email().safeParse(email).success) return { ok: false, error: "이메일 형식을 확인해주세요." };

  const bizNo = str(fd, "business_number");
  if (bizNo && !/^\d{3}-\d{2}-\d{5}$/.test(bizNo)) return { ok: false, error: "사업자등록번호는 000-00-00000 형식으로 입력해주세요." };

  const fields = {
    site_name: str(fd, "site_name").slice(0, 30) || "딜투게더",
    ceo_name: str(fd, "ceo_name").slice(0, 30) || null,
    business_number: bizNo || null,
    ecommerce_number: str(fd, "ecommerce_number").slice(0, 50) || null,
    business_address: str(fd, "business_address").slice(0, 200) || null,
    cs_phone: str(fd, "cs_phone").slice(0, 20) || null,
    cs_email: email || null,
    cs_hours: str(fd, "cs_hours").slice(0, 100) || null,
  };

  const { error } = await db().from("site_settings").update(fields).eq("id", 1);
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, "update_business_settings", fields);
  return done();
}