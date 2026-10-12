"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const uuid = z.string().uuid();

async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown> = {}) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "content", target_id: targetId, detail });
}
function done(message = "저장되었습니다."): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}
function fail(e: unknown): ActionResult {
  console.error(e);
  return { ok: false, error: "저장 중 오류가 발생했습니다." };
}

// ---------- 약관·정책 ----------
export async function updatePolicy(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const key = str(fd, "key");
  if (!["terms", "privacy", "refund"].includes(key)) return { ok: false, error: "잘못된 요청입니다." };
  const body = String(fd.get("body") ?? "").slice(0, 50000);
  const { error } = await db().from("policies").update({ body }).eq("key", key);
  if (error) return fail(error);
  await log(staff.id, "update_policy", key, { length: body.length });
  return done();
}

// ---------- 공지사항 ----------
const noticeSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(150),
  body: z.string().min(1, "내용을 입력해주세요.").max(20000),
});

export async function createNotice(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const p = noticeSchema.safeParse({ title: str(fd, "title"), body: str(fd, "body") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { data, error } = await db()
    .from("notices")
    .insert({ ...p.data, is_pinned: bool(fd, "is_pinned"), is_published: bool(fd, "is_published") })
    .select("id")
    .single();
  if (error) return fail(error);
  await log(staff.id, "create_notice", data.id, { title: p.data.title });
  return done("공지가 등록되었습니다.");
}

export async function updateNotice(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const p = noticeSchema.safeParse({ title: str(fd, "title"), body: str(fd, "body") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { error } = await db()
    .from("notices")
    .update({ ...p.data, is_pinned: bool(fd, "is_pinned"), is_published: bool(fd, "is_published") })
    .eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_notice", id);
  return done();
}

export async function deleteNotice(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("notices").delete().eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "delete_notice", id);
  return done("삭제되었습니다.");
}

// ---------- FAQ ----------
const faqSchema = z.object({
  category: z.string().min(1, "분류를 입력해주세요.").max(20),
  question: z.string().min(1, "질문을 입력해주세요.").max(200),
  answer: z.string().min(1, "답변을 입력해주세요.").max(5000),
  sort_order: z.number().int(),
});

function faqInput(fd: FormData) {
  return faqSchema.safeParse({
    category: str(fd, "category"),
    question: str(fd, "question"),
    answer: str(fd, "answer"),
    sort_order: Number(str(fd, "sort_order")) || 0,
  });
}

export async function createFaq(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const p = faqInput(fd);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { data, error } = await db()
    .from("faqs")
    .insert({ ...p.data, is_published: bool(fd, "is_published") })
    .select("id")
    .single();
  if (error) return fail(error);
  await log(staff.id, "create_faq", data.id, { question: p.data.question });
  return done("FAQ가 등록되었습니다.");
}

export async function updateFaq(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const p = faqInput(fd);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { error } = await db().from("faqs").update({ ...p.data, is_published: bool(fd, "is_published") }).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_faq", id);
  return done();
}

export async function deleteFaq(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("faqs").delete().eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "delete_faq", id);
  return done("삭제되었습니다.");
}