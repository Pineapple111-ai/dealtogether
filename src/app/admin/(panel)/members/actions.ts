"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const uuid = z.string().uuid();

async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown> = {}) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "member", target_id: targetId, detail });
}

/** 일반 회원인지 확인 (관리자 계정은 대상에서 제외) */
async function getCustomer(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const { data } = await db().from("profiles").select("id, role, name").eq("id", id).maybeSingle();
  return data && data.role === "customer" ? data : null;
}

/** 헷갈리는 문자(0,O,1,l,I) 제외, 영문+숫자 보장 10자리 */
function makeTempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 10) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function issueTempPassword(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("members");
  const member = await getCustomer(String(fd.get("id") ?? ""));
  if (!member) return { ok: false, error: "일반 회원만 처리할 수 있습니다." };

  const temp = makeTempPassword();
  const { error } = await db().auth.admin.updateUserById(member.id, { password: temp });
  if (error) {
    console.error("임시 비밀번호 발급 실패", error);
    return { ok: false, error: "임시 비밀번호 발급에 실패했습니다." };
  }
  await log(staff.id, "issue_temp_password", member.id); // 비밀번호는 기록하지 않음
  return {
    ok: true,
    message: `임시 비밀번호: ${temp}  — 고객에게 전달하고, 로그인 후 마이페이지에서 비밀번호를 변경하도록 안내하세요. (이 화면을 벗어나면 다시 볼 수 없습니다)`,
  };
}

export async function setSuspended(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("members");
  const member = await getCustomer(String(fd.get("id") ?? ""));
  if (!member) return { ok: false, error: "일반 회원만 처리할 수 있습니다." };
  const suspend = fd.get("suspend") === "1";

  const { error } = await db().auth.admin.updateUserById(member.id, {
    ban_duration: suspend ? "876000h" : "none",
  });
  if (error) {
    console.error(error);
    return { ok: false, error: "처리 중 오류가 발생했습니다." };
  }
  await db().from("profiles").update({ is_suspended: suspend }).eq("id", member.id);
  await log(staff.id, suspend ? "suspend_member" : "unsuspend_member", member.id);
  revalidatePath("/admin/members");
  return { ok: true, message: suspend ? "계정이 정지되었습니다." : "정지가 해제되었습니다." };
}

export async function saveMemberMemo(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("members");
  const member = await getCustomer(String(fd.get("id") ?? ""));
  if (!member) return { ok: false, error: "일반 회원만 처리할 수 있습니다." };
  const memo = String(fd.get("admin_memo") ?? "").trim().slice(0, 2000);

  const { error } = await db().from("profiles").update({ admin_memo: memo || null }).eq("id", member.id);
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다." };
  await log(staff.id, "save_member_memo", member.id);
  revalidatePath("/admin/members");
  return { ok: true, message: "저장되었습니다." };
}