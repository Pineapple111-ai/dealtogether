"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const uuid = z.string().uuid();

async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown>) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "discount", target_id: targetId, detail });
}
function done(message = "저장되었습니다."): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** 구간 입력(min_0~4, rate_0~4) → 검증된 tiers */
function parseTiers(fd: FormData, ruleType: string) {
  const tiers: { min: number; rate: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const minRaw = str(fd, `min_${i}`).replace(/[^0-9]/g, "");
    const rateRaw = str(fd, `rate_${i}`);
    if (!minRaw && !rateRaw) continue;
    const min = Number(minRaw);
    const rate = Number(rateRaw);
    if (!Number.isInteger(min) || min <= 0) return { error: `${i + 1}번째 구간의 기준값을 확인해주세요.` };
    if (ruleType !== "amount" && min < 2) return { error: "개수·분류 기준은 2 이상이어야 합니다." };
    if (!Number.isFinite(rate) || rate <= 0 || rate > 50) return { error: `${i + 1}번째 구간의 할인율은 0 초과 50 이하로 입력해주세요.` };
    tiers.push({ min, rate: Math.round(rate * 100) / 100 });
  }
  tiers.sort((a, b) => a.min - b.min);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].min === tiers[i - 1].min) return { error: "같은 기준값이 중복되었습니다." };
    if (tiers[i].rate < tiers[i - 1].rate) return { error: "기준이 높을수록 할인율도 같거나 높아야 합니다." };
  }
  return { tiers };
}

export async function updateRule(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const ruleType = str(fd, "rule_type");
  if (!uuid.safeParse(id).success || !["count", "category", "amount"].includes(ruleType)) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const name = str(fd, "name");
  if (!name || name.length > 40) return { ok: false, error: "규칙 이름을 입력해주세요. (40자 이내)" };

  const r = parseTiers(fd, ruleType);
  if ("error" in r) return { ok: false, error: r.error };
  const isActive = fd.get("is_active") === "on";
  if (isActive && r.tiers.length === 0) return { ok: false, error: "사용하려면 구간을 1개 이상 입력해주세요." };

  const { error } = await db()
    .from("discount_rules")
    .update({ name, tiers: r.tiers, is_active: isActive })
    .eq("id", id);
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, "update_discount_rule", id, { name, tiers: r.tiers, isActive });
  return done();
}

export async function updateMaxRate(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const rate = Number(str(fd, "bundle_max_rate"));
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) return { ok: false, error: "상한은 0~50% 사이로 입력해주세요." };
  const { error } = await db().from("site_settings").update({ bundle_max_rate: rate }).eq("id", 1);
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, "update_bundle_max_rate", "site", { rate });
  return done();
}