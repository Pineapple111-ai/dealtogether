"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { fromKstInput } from "@/lib/admin/datetime";
import { isAllowedPaymentUrl } from "@/lib/payment";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(/[^0-9-]/g, ""));
const uuid = z.string().uuid();

function fail(e: { code?: string; message: string }): ActionResult {
  if (e.code === "23505") return { ok: false, error: "이미 사용 중인 주소(slug)입니다." };
  console.error(e);
  return { ok: false, error: "저장 중 오류가 발생했습니다." };
}
async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown>) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "campaign", target_id: targetId, detail });
}

/** 공통 입력 검증 */
async function parseCampaign(fd: FormData) {
  const startAt = fromKstInput(str(fd, "start_at"));
  const endAt = fromKstInput(str(fd, "end_at"));
  if (!startAt || !endAt) return { error: "모집 시작일과 종료일을 입력해주세요." } as const;
  if (new Date(endAt) <= new Date(startAt)) return { error: "종료일은 시작일 이후여야 합니다." } as const;

  const p = z
    .object({
      name: z.string().min(1, "캠페인명을 입력해주세요.").max(100),
      slug: z.string().regex(/^[a-z0-9-]{3,80}$/, "주소(slug)는 영문 소문자·숫자·하이픈 3~80자로 입력해주세요."),
      target_participants: z.number().int().min(1, "목표 인원은 1명 이상이어야 합니다."),
      max_quantity: z.number().int().min(1, "판매 가능 수량은 1세트 이상이어야 합니다."),
      per_user_limit: z.number().int().min(1, "1인 구매 한도는 1 이상이어야 합니다."),
      campaign_price: z.number().int().min(0, "공동구매가를 입력해주세요."),
    })
    .safeParse({
      name: str(fd, "name"),
      slug: str(fd, "slug").toLowerCase(),
      target_participants: num(fd, "target_participants"),
      max_quantity: num(fd, "max_quantity"),
      per_user_limit: num(fd, "per_user_limit") || 1,
      campaign_price: num(fd, "campaign_price"),
    });
  if (!p.success) return { error: p.error.issues[0].message } as const;
  if (p.data.per_user_limit > p.data.max_quantity) return { error: "1인 한도가 판매 가능 수량보다 클 수 없습니다." } as const;

  const paymentUrl = str(fd, "payment_url");
  if (paymentUrl) {
    const { data: site } = await db().from("site_settings").select("allowed_payment_domains").eq("id", 1).single();
    if (!isAllowedPaymentUrl(paymentUrl, site?.allowed_payment_domains ?? [])) {
      return { error: "결제 링크는 https:// 주소이며 승인된 결제 도메인이어야 합니다." } as const;
    }
  }

  const soon = num(fd, "closing_soon_hours");
  return {
    data: {
      ...p.data,
      start_at: startAt,
      end_at: endAt,
      payment_url: paymentUrl || null,
      closing_soon_hours: soon > 0 ? soon : null,
      is_visible: bool(fd, "is_visible"),
    },
  } as const;
}

export async function createCampaign(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("campaigns");
  const packageId = str(fd, "package_id");
  if (!uuid.safeParse(packageId).success) return { ok: false, error: "패키지를 선택해주세요." };

  const r = await parseCampaign(fd);
  if ("error" in r) return { ok: false, error: r.error };

  const { data, error } = await db().from("campaigns").insert({ ...r.data, package_id: packageId }).select("id").single();
  if (error) return fail(error);
  await log(staff.id, "create_campaign", data.id, { name: r.data.name });
  revalidatePath("/admin/campaigns", "layout");
  redirect(`/admin/campaigns/${data.id}`);
}

export async function updateCampaign(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("campaigns");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const r = await parseCampaign(fd);
  if ("error" in r) return { ok: false, error: r.error };

  // 판매·예약된 수량보다 줄일 수 없음
  const { data: stats } = await db().from("campaign_stats").select("*").eq("campaign_id", id).maybeSingle();
  const used = (stats?.sold_quantity ?? 0) + (stats?.reserved_quantity ?? 0);
  if (r.data.max_quantity < used) {
    return { ok: false, error: `이미 판매·예약된 수량(${used}세트)보다 적게 설정할 수 없습니다.` };
  }

  const { error } = await db().from("campaigns").update(r.data).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_campaign", id, r.data);
  revalidatePath("/admin/campaigns", "layout");
  return { ok: true, message: "저장되었습니다. 기존 주문 금액은 변경되지 않습니다." };
}

export async function setCampaignState(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("campaigns");
  const id = str(fd, "id");
  const state = str(fd, "state");
  if (!uuid.safeParse(id).success || !["closed", "cancelled", "open"].includes(state)) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const { error } = await db()
    .from("campaigns")
    .update({ manual_state: state === "open" ? null : state })
    .eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "set_campaign_state", id, { state });
  revalidatePath("/admin/campaigns", "layout");
  const msg = { closed: "조기 마감되었습니다.", cancelled: "캠페인이 취소되었습니다.", open: "모집이 재개되었습니다." }[state];
  return { ok: true, message: msg };
}

/** 패키지 복사 (구성품·허용 SKU·추가금 포함) */
async function copyPackage(packageId: string): Promise<string | null> {
  const sb = db();
  const { data: src } = await sb.from("packages").select("*, package_items(*, package_item_skus(*))").eq("id", packageId).single();
  if (!src) return null;
  const suffix = Date.now().toString(36);
  const { data: copy } = await sb
    .from("packages")
    .insert({
      brand_id: src.brand_id, category_id: src.category_id, name: src.name,
      slug: `${src.slug}-${suffix}`.slice(0, 80), product_code: null, summary: src.summary,
      description: src.description, list_price: src.list_price, thumbnail_url: src.thumbnail_url,
      images: src.images, status: "active",
    })
    .select("id")
    .single();
  if (!copy) return null;

  type SrcItem = {
    product_id: string; label: string; is_required: boolean; optional_price: number; quantity: number; sort_order: number;
    package_item_skus: { sku_id: string; price_adjustment: number; is_default: boolean }[];
  };
  for (const it of (src.package_items ?? []) as SrcItem[]) {
    const { data: ni } = await sb
      .from("package_items")
      .insert({
        package_id: copy.id, product_id: it.product_id, label: it.label, is_required: it.is_required,
        optional_price: it.optional_price, quantity: it.quantity, sort_order: it.sort_order,
      })
      .select("id")
      .single();
    if (!ni) return null;
    if (it.package_item_skus.length) {
      await sb.from("package_item_skus").insert(
        it.package_item_skus.map((s) => ({ package_item_id: ni.id, sku_id: s.sku_id, price_adjustment: s.price_adjustment, is_default: s.is_default }))
      );
    }
  }
  return copy.id;
}

/** 기존 캠페인 복제: 새 기간·목표·수량·가격. 주문/참여 기록은 복제하지 않음 */
export async function duplicateCampaign(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("campaigns");
  const srcId = str(fd, "source_id");
  if (!uuid.safeParse(srcId).success) return { ok: false, error: "잘못된 요청입니다." };

  const { data: src } = await db().from("campaigns").select("*").eq("id", srcId).single();
  if (!src) return { ok: false, error: "원본 캠페인을 찾을 수 없습니다." };

  const r = await parseCampaign(fd);
  if ("error" in r) return { ok: false, error: r.error };

  let packageId: string = src.package_id;
  if (bool(fd, "copy_package")) {
    const copied = await copyPackage(src.package_id);
    if (!copied) return { ok: false, error: "패키지 복사에 실패했습니다." };
    packageId = copied;
  }

  const { data, error } = await db()
    .from("campaigns")
    .insert({
      ...r.data,
      package_id: packageId,
      sale_type: src.sale_type,
      allow_early_close: src.allow_early_close,
      payment_url: r.data.payment_url ?? (bool(fd, "keep_payment_url") ? src.payment_url : null),
    })
    .select("id")
    .single();
  if (error) return fail(error);

  await log(staff.id, "duplicate_campaign", data.id, { from: srcId, copy_package: packageId !== src.package_id });
  revalidatePath("/admin/campaigns", "layout");
  redirect(`/admin/campaigns/${data.id}`);
}