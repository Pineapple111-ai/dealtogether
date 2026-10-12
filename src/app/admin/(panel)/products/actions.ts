"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import type { ActionResult } from "@/lib/admin/action-result";

const db = () => createAdminClient();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(/[^0-9-]/g, ""));
const uuid = z.string().uuid();

function done(message = "저장되었습니다."): ActionResult {
  revalidatePath("/admin/products", "layout");
  return { ok: true, message };
}

function fail(e: { code?: string; message: string }): ActionResult {
  if (e.code === "23505") return { ok: false, error: "이미 사용 중인 코드입니다. 다른 코드를 입력해주세요." };
  console.error(e);
  return { ok: false, error: "저장 중 오류가 발생했습니다." };
}

async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown>) {
  await db().from("admin_activity_logs").insert({
    admin_id: adminId, action, target_type: "product", target_id: targetId, detail,
  });
}

function parseKeys(raw: string) {
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

// ---------- 제품 ----------
const productSchema = z.object({
  brand_id: z.string().uuid("브랜드를 선택해주세요."),
  product_type: z.string().min(1, "제품 종류를 입력해주세요.").max(30),
  name: z.string().min(1, "제품명을 입력해주세요.").max(100),
  attribute_keys: z.array(z.string().max(20)).max(5, "선택 항목은 최대 5개까지 가능합니다."),
  description: z.string().max(2000),
});

export async function createProduct(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const p = productSchema.safeParse({
    brand_id: str(fd, "brand_id"),
    product_type: str(fd, "product_type"),
    name: str(fd, "name"),
    attribute_keys: parseKeys(str(fd, "attribute_keys")),
    description: str(fd, "description"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const { data, error } = await db().from("products").insert(p.data).select("id").single();
  if (error) return fail(error);
  await log(staff.id, "create_product", data.id, { name: p.data.name });
  revalidatePath("/admin/products", "layout");
  redirect(`/admin/products/${data.id}`);
}

export async function updateProduct(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const p = productSchema.omit({ brand_id: true }).safeParse({
    product_type: str(fd, "product_type"),
    name: str(fd, "name"),
    attribute_keys: parseKeys(str(fd, "attribute_keys")),
    description: str(fd, "description"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const status = str(fd, "status") === "inactive" ? "inactive" : "active";

  const { error } = await db().from("products").update({ ...p.data, status }).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_product", id, { ...p.data, status });
  return done();
}

// ---------- 모델 ----------
export async function createModel(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const p = z
    .object({
      product_id: uuid,
      model_code: z.string().min(1, "모델 코드를 입력해주세요.").max(50),
      model_name: z.string().min(1, "모델명을 입력해주세요.").max(100),
      image_url: z.union([z.string().url("이미지 URL 형식을 확인해주세요."), z.literal("")]),
      sort_order: z.number().int(),
    })
    .safeParse({
      product_id: str(fd, "product_id"),
      model_code: str(fd, "model_code").toUpperCase(),
      model_name: str(fd, "model_name"),
      image_url: str(fd, "image_url"),
      sort_order: num(fd, "sort_order") || 0,
    });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const { error } = await db().from("product_models").insert({ ...p.data, image_url: p.data.image_url || null });
  if (error) return fail(error);
  await log(staff.id, "create_model", p.data.product_id, { model_code: p.data.model_code });
  return done("모델이 추가되었습니다.");
}

export async function setModelStatus(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const status = str(fd, "status") === "inactive" ? "inactive" : "active";
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("product_models").update({ status }).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "set_model_status", id, { status });
  return done();
}

// ---------- SKU ----------
export async function createSku(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const modelId = str(fd, "model_id");
  if (!uuid.safeParse(modelId).success) return { ok: false, error: "잘못된 요청입니다." };

  const { data: model } = await db()
    .from("product_models")
    .select("id, product:products(attribute_keys)")
    .eq("id", modelId)
    .single();
  const keys = ((model as unknown as { product: { attribute_keys: string[] } } | null)?.product.attribute_keys) ?? [];

  const attributes: Record<string, string> = {};
  for (const k of keys) {
    const v = str(fd, `attr:${k}`);
    if (!v) return { ok: false, error: `${k} 값을 입력해주세요.` };
    attributes[k] = v.slice(0, 30);
  }

  const sku = str(fd, "sku").toUpperCase();
  const stock = num(fd, "stock");
  if (!/^[A-Z0-9-_]{3,60}$/.test(sku)) return { ok: false, error: "SKU 코드는 영문 대문자·숫자·하이픈 3~60자로 입력해주세요." };
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: "재고는 0 이상의 숫자로 입력해주세요." };

  const image = str(fd, "image_url");
  const { error } = await db().from("product_skus").insert({
    model_id: modelId, sku, attributes, stock, image_url: image || null, sort_order: num(fd, "sort_order") || 0,
  });
  if (error) return fail(error);
  await log(staff.id, "create_sku", sku, { attributes, stock });
  return done("SKU가 추가되었습니다.");
}

export async function updateSku(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const stock = num(fd, "stock");
  const status = ["active", "inactive", "soldout"].includes(str(fd, "status")) ? str(fd, "status") : "active";
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: "재고는 0 이상이어야 합니다." };

  const { error } = await db().from("product_skus").update({ stock, status }).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_sku", id, { stock, status });
  return done();
}

// ---------- 부가 옵션 ----------
export async function createAddonGroup(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const productId = str(fd, "product_id");
  const name = str(fd, "name");
  const selectType = str(fd, "select_type") === "multi" ? "multi" : "single";
  if (!uuid.safeParse(productId).success) return { ok: false, error: "잘못된 요청입니다." };
  if (!name || name.length > 30) return { ok: false, error: "옵션 그룹명을 입력해주세요. (30자 이내)" };

  const { error } = await db().from("addon_groups").insert({
    product_id: productId,
    name,
    select_type: selectType,
    ui_type: selectType === "multi" ? "checkbox" : "radio",
    is_required: bool(fd, "is_required"),
    sort_order: num(fd, "sort_order") || 0,
  });
  if (error) return fail(error);
  await log(staff.id, "create_addon_group", productId, { name });
  return done("옵션 그룹이 추가되었습니다.");
}

export async function createAddonValue(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const groupId = str(fd, "group_id");
  const label = str(fd, "label");
  const price = num(fd, "price") || 0;
  if (!uuid.safeParse(groupId).success) return { ok: false, error: "잘못된 요청입니다." };
  if (!label || label.length > 40) return { ok: false, error: "옵션명을 입력해주세요. (40자 이내)" };
  if (price < 0) return { ok: false, error: "추가 금액은 0원 이상이어야 합니다." };

  const isDefault = bool(fd, "is_default");
  if (isDefault) await db().from("addon_values").update({ is_default: false }).eq("group_id", groupId);

  const { error } = await db().from("addon_values").insert({
    group_id: groupId,
    label,
    price,
    is_default: isDefault,
    is_quote_required: bool(fd, "is_quote_required"),
    sort_order: num(fd, "sort_order") || 0,
  });
  if (error) return fail(error);
  await log(staff.id, "create_addon_value", groupId, { label, price });
  return done("옵션이 추가되었습니다.");
}

export async function updateAddonValue(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const price = num(fd, "price");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  if (!Number.isInteger(price) || price < 0) return { ok: false, error: "추가 금액은 0원 이상이어야 합니다." };

  const { error } = await db()
    .from("addon_values")
    .update({ price, is_active: bool(fd, "is_active") })
    .eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_addon_value", id, { price });
  return done();
}