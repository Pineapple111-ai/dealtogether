"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { fromKstInput } from "@/lib/admin/datetime";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const uuid = z.string().uuid();

const isImage = (v: string) => /^\/images\/[\w\-/.]+$/.test(v) || /^https:\/\/\S+$/.test(v);
const isLink = (v: string) => /^\/[\w\-/.?=&%#]*$/.test(v) || /^https:\/\/\S+$/.test(v);

function period(fd: FormData) {
  const s = str(fd, "start_at");
  const e = str(fd, "end_at");
  const start = s ? fromKstInput(s) : null;
  const end = e ? fromKstInput(e) : null;
  if (s && !start) return { error: "시작 일시를 확인해주세요." } as const;
  if (e && !end) return { error: "종료 일시를 확인해주세요." } as const;
  if (start && end && new Date(end) <= new Date(start)) return { error: "종료 일시는 시작 이후여야 합니다." } as const;
  return { start, end } as const;
}

async function log(adminId: string, action: string, targetId: string) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "content", target_id: targetId, detail: {} });
}

function done(message = "저장되었습니다."): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

// ---------- 배너 ----------
function bannerFields(fd: FormData) {
  const title = str(fd, "title");
  const imagePc = str(fd, "image_pc");
  const imageMobile = str(fd, "image_mobile");
  const link = str(fd, "link_url");
  if (!title || title.length > 60) return { error: "제목을 입력해주세요. (60자 이내)" } as const;
  if (!isImage(imagePc)) return { error: "PC 이미지를 올려주세요." } as const;
  if (imageMobile && !isImage(imageMobile)) return { error: "모바일 이미지 주소를 확인해주세요." } as const;
  if (link && !isLink(link)) return { error: "링크는 / 로 시작하는 사이트 주소나 https:// 주소로 입력해주세요." } as const;
  const p = period(fd);
  if ("error" in p) return { error: p.error } as const;
  return {
    data: {
      eyebrow: str(fd, "eyebrow").slice(0, 60) || null,
      title,
      subtitle: str(fd, "subtitle").slice(0, 120) || null,
      image_pc: imagePc,
      image_mobile: imageMobile || null,
      button_label: str(fd, "button_label").slice(0, 20) || null,
      link_url: link || null,
      start_at: p.start,
      end_at: p.end,
      sort_order: Number(str(fd, "sort_order")) || 0,
      is_active: fd.get("is_active") === "on",
    },
  } as const;
}

export async function saveBanner(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  const r = bannerFields(fd);
  if ("error" in r) return { ok: false, error: r.error };

  const q = id && uuid.safeParse(id).success
    ? db().from("banners").update(r.data).eq("id", id)
    : db().from("banners").insert(r.data);
  const { error } = await q;
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, id ? "update_banner" : "create_banner", id || r.data.title);
  return done(id ? "저장되었습니다." : "배너가 등록되었습니다.");
}

export async function deleteBanner(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("banners").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제 중 오류가 발생했습니다." };
  await log(staff.id, "delete_banner", id);
  return done("삭제되었습니다.");
}

// ---------- 팝업 ----------
export async function savePopup(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  const title = str(fd, "title");
  const image = str(fd, "image_url");
  const link = str(fd, "link_url");
  if (!title || title.length > 60) return { ok: false, error: "제목을 입력해주세요. (60자 이내)" };
  if (image && !isImage(image)) return { ok: false, error: "이미지 주소를 확인해주세요." };
  if (link && !isLink(link)) return { ok: false, error: "링크는 / 로 시작하는 사이트 주소나 https:// 주소로 입력해주세요." };
  const body = str(fd, "body").slice(0, 1000);
  if (!image && !body) return { ok: false, error: "이미지나 내용 중 하나는 입력해주세요." };
  const p = period(fd);
  if ("error" in p) return { ok: false, error: p.error! };

  const data = {
    title,
    body: body || null,
    image_url: image || null,
    button_label: str(fd, "button_label").slice(0, 20) || null,
    link_url: link || null,
    start_at: p.start,
    end_at: p.end,
    sort_order: Number(str(fd, "sort_order")) || 0,
    is_active: fd.get("is_active") === "on",
  };
  const q = id && uuid.safeParse(id).success
    ? db().from("popups").update(data).eq("id", id)
    : db().from("popups").insert(data);
  const { error } = await q;
  if (error) {
    console.error(error);
    return { ok: false, error: "저장 중 오류가 발생했습니다." };
  }
  await log(staff.id, id ? "update_popup" : "create_popup", id || title);
  return done(id ? "저장되었습니다." : "팝업이 등록되었습니다.");
}

export async function deletePopup(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("content");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("popups").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제 중 오류가 발생했습니다." };
  await log(staff.id, "delete_popup", id);
  return done("삭제되었습니다.");
}