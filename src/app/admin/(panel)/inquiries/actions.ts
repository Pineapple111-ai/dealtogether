"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import type { ActionResult } from "@/lib/admin/action-result";

export async function updateInquiry(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("cs");
  const id = String(fd.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const status = String(fd.get("status") ?? "");
  if (!["new", "in_progress", "done"].includes(status)) return { ok: false, error: "상태를 선택해주세요." };

  const assignee = String(fd.get("assignee_id") ?? "");
  const answer = String(fd.get("answer") ?? "").trim().slice(0, 5000);
  const memo = String(fd.get("admin_memo") ?? "").trim().slice(0, 2000);

  const db = createAdminClient();
  const { data: cur } = await db.from("inquiries").select("answer").eq("id", id).single();

  const { error } = await db
    .from("inquiries")
    .update({
      status,
      assignee_id: z.string().uuid().safeParse(assignee).success ? assignee : null,
      admin_memo: memo || null,
      answer: answer || null,
      answered_at: answer && answer !== cur?.answer ? new Date().toISOString() : undefined,
    })
    .eq("id", id);
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }

  await db.from("admin_activity_logs").insert({
    admin_id: staff.id, action: "update_inquiry", target_type: "inquiry", target_id: id, detail: { status },
  });
  revalidatePath("/admin/inquiries");
  return { ok: true, message: "저장되었습니다." };
}