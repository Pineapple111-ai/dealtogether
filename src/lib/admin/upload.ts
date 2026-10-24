"use server";

import { getStaff, can } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const FOLDERS = ["banners", "popups", "products"];

export type UploadTicket =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string };

export async function createImageUpload(folder: string, contentType: string, size: number): Promise<UploadTicket> {
  const staff = await getStaff();
  if (!staff || !(can(staff.role, "content") || can(staff.role, "products"))) {
    return { ok: false, error: "업로드 권한이 없습니다." };
  }
  if (!FOLDERS.includes(folder)) return { ok: false, error: "잘못된 요청입니다." };
  const ext = TYPES[contentType];
  if (!ext) return { ok: false, error: "JPG, PNG, WEBP 이미지만 올릴 수 있습니다." };
  if (size > 5 * 1024 * 1024) return { ok: false, error: "5MB 이하 이미지만 올릴 수 있습니다." };

  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const sb = createAdminClient();
  const { data, error } = await sb.storage.from("site").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("업로드 URL 발급 실패", error);
    return { ok: false, error: "업로드 준비에 실패했습니다." };
  }
  const { data: pub } = sb.storage.from("site").getPublicUrl(path);
  return { ok: true, path, token: data.token, publicUrl: pub.publicUrl };
}