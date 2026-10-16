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
  revalidatePath("/admin/packages", "layout");
  return { ok: true, message };
}
function fail(e: { code?: string; message: string }): ActionResult {
  if (e.code === "23505") return { ok: false, error: "이미 사용 중인 주소(slug) 또는 상품코드입니다." };
  if (e.code === "23503") return { ok: false, error: "주문 이력이 있어 삭제할 수 없습니다. 대신 판매 상태를 변경하세요." };
  console.error(e);
  return { ok: false, error: "저장 중 오류가 발생했습니다." };
}
async function log(adminId: string, action: string, targetId: string, detail: Record<string, unknown>) {
  await db().from("admin_activity_logs").insert({ admin_id: adminId, action, target_type: "package", target_id: targetId, detail });
}

function parseImages(raw: string) {
  const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const u of urls) {
    try {
      if (new URL(u).protocol !== "https:") return null;
    } catch {
      return null;
    }
  }
  return urls.slice(0, 20);
}

const baseSchema = z.object({
  name: z.string().min(1, "패키지명을 입력해주세요.").max(100),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/, "주소(slug)는 영문 소문자·숫자·하이픈 3~80자로 입력해주세요."),
  product_code: z.string().max(40),
  summary: z.string().max(200),
  list_price: z.number().int("정상가를 숫자로 입력해주세요.").min(0),
});

// ---------- 패키지 ----------
export async function createPackage(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const p = baseSchema
    .extend({ brand_id: z.string().uuid("브랜드를 선택해주세요."), category_id: z.string().uuid("공간을 선택해주세요.") })
    .safeParse({
      brand_id: str(fd, "brand_id"),
      category_id: str(fd, "category_id"),
      name: str(fd, "name"),
      slug: str(fd, "slug").toLowerCase(),
      product_code: str(fd, "product_code").toUpperCase(),
      summary: str(fd, "summary"),
      list_price: num(fd, "list_price"),
    });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const { data, error } = await db()
    .from("packages")
    .insert({ ...p.data, product_code: p.data.product_code || null })
    .select("id")
    .single();
  if (error) return fail(error);
  await log(staff.id, "create_package", data.id, { name: p.data.name });
  revalidatePath("/admin/packages", "layout");
  redirect(`/admin/packages/${data.id}`);
}

export async function updatePackage(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const p = baseSchema
    .extend({ category_id: z.string().uuid(), description: z.string().max(10000) })
    .safeParse({
      category_id: str(fd, "category_id"),
      name: str(fd, "name"),
      slug: str(fd, "slug").toLowerCase(),
      product_code: str(fd, "product_code").toUpperCase(),
      summary: str(fd, "summary"),
      list_price: num(fd, "list_price"),
      description: str(fd, "description"),
    });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const thumb = str(fd, "thumbnail_url");
  const images = parseImages(str(fd, "images"));
  if (images === null) return { ok: false, error: "이미지 주소는 https:// 로 시작하는 URL을 한 줄에 하나씩 입력해주세요." };
  if (thumb && parseImages(thumb) === null) return { ok: false, error: "대표 이미지 주소를 확인해주세요." };

  const status = str(fd, "status") === "inactive" ? "inactive" : "active";
  const { error } = await db()
    .from("packages")
    .update({ ...p.data, product_code: p.data.product_code || null, thumbnail_url: thumb || null, images, status })
    .eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_package", id, { name: p.data.name, list_price: p.data.list_price, status });
  return done();
}

export async function duplicatePackage(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const sb = db();
  const { data: src } = await sb
    .from("packages")
    .select("*, package_items(*, package_item_skus(*))")
    .eq("id", id)
    .single();
  if (!src) return { ok: false, error: "원본 패키지를 찾을 수 없습니다." };

  const suffix = Date.now().toString(36);
  const { data: copy, error } = await sb
    .from("packages")
    .insert({
      brand_id: src.brand_id,
      category_id: src.category_id,
      name: `${src.name} (복사본)`,
      slug: `${src.slug}-${suffix}`.slice(0, 80),
      product_code: null,
      summary: src.summary,
      description: src.description,
      list_price: src.list_price,
      thumbnail_url: src.thumbnail_url,
      images: src.images,
      status: "inactive",
    })
    .select("id")
    .single();
  if (error || !copy) return fail(error ?? { message: "copy failed" });

  type SrcItem = {
    product_id: string; label: string; is_required: boolean; optional_price: number; quantity: number; sort_order: number;
    package_item_skus: { sku_id: string; price_adjustment: number; is_default: boolean }[];
  };
  for (const it of (src.package_items ?? []) as SrcItem[]) {
    const { data: newItem, error: itemErr } = await sb
      .from("package_items")
      .insert({
        package_id: copy.id, product_id: it.product_id, label: it.label, is_required: it.is_required,
        optional_price: it.optional_price, quantity: it.quantity, sort_order: it.sort_order,
      })
      .select("id")
      .single();
    if (itemErr || !newItem) return fail(itemErr ?? { message: "item copy failed" });
    if (it.package_item_skus.length) {
      const { error: skuErr } = await sb.from("package_item_skus").insert(
        it.package_item_skus.map((s) => ({
          package_item_id: newItem.id, sku_id: s.sku_id, price_adjustment: s.price_adjustment, is_default: s.is_default,
        }))
      );
      if (skuErr) return fail(skuErr);
    }
  }

  await log(staff.id, "duplicate_package", copy.id, { from: id });
  revalidatePath("/admin/packages", "layout");
  redirect(`/admin/packages/${copy.id}`);
}

// ---------- 구성품 ----------
export async function addPackageItem(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const packageId = str(fd, "package_id");
  const productId = str(fd, "product_id");
  const label = str(fd, "label");
  const quantity = num(fd, "quantity") || 1;
  const isRequired = str(fd, "kind") !== "optional";
  const optionalPrice = isRequired ? 0 : num(fd, "optional_price") || 0;

  if (!uuid.safeParse(packageId).success || !uuid.safeParse(productId).success) return { ok: false, error: "제품을 선택해주세요." };
  if (!label || label.length > 30) return { ok: false, error: "표시명을 입력해주세요. (예: TV, 사운드바)" };
  if (quantity < 1 || quantity > 10) return { ok: false, error: "세트당 수량은 1~10 사이로 입력해주세요." };
  if (optionalPrice < 0) return { ok: false, error: "선택 구성품 금액을 확인해주세요." };

  const { error } = await db().from("package_items").insert({
    package_id: packageId, product_id: productId, label, is_required: isRequired,
    optional_price: optionalPrice, quantity, sort_order: num(fd, "sort_order") || 0,
  });
  if (error) return fail(error);
  await log(staff.id, "add_package_item", packageId, { product_id: productId, label });
  return done("구성품이 추가되었습니다. 아래에서 허용 SKU를 지정하세요.");
}

export async function updatePackageItem(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const label = str(fd, "label");
  const quantity = num(fd, "quantity") || 1;
  const isRequired = str(fd, "kind") !== "optional";
  const optionalPrice = isRequired ? 0 : num(fd, "optional_price") || 0;
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  if (!label) return { ok: false, error: "표시명을 입력해주세요." };
  if (quantity < 1 || quantity > 10) return { ok: false, error: "세트당 수량은 1~10 사이로 입력해주세요." };

  const { error } = await db()
    .from("package_items")
    .update({ label, is_required: isRequired, optional_price: optionalPrice, quantity, sort_order: num(fd, "sort_order") || 0 })
    .eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_package_item", id, { label, isRequired, optionalPrice, quantity });
  return done();
}

export async function deletePackageItem(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };
  const { error } = await db().from("package_items").delete().eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "delete_package_item", id, {});
  return done("구성품이 삭제되었습니다.");
}

/** 구성품의 허용 SKU · 추가금 · 기본값 일괄 저장 */
export async function savePackageItemSkus(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const itemId = str(fd, "package_item_id");
  if (!uuid.safeParse(itemId).success) return { ok: false, error: "잘못된 요청입니다." };

  const defaultSku = str(fd, "default_sku");
  const rows: { package_item_id: string; sku_id: string; price_adjustment: number; is_default: boolean }[] = [];

  for (const [key, val] of fd.entries()) {
    if (!key.startsWith("allow:") || val !== "on") continue;
    const skuId = key.slice(6);
    if (!uuid.safeParse(skuId).success) continue;
    const adj = num(fd, `adj:${skuId}`) || 0;
    if (adj < 0) return { ok: false, error: "추가금은 0원 이상이어야 합니다." };
    rows.push({ package_item_id: itemId, sku_id: skuId, price_adjustment: adj, is_default: skuId === defaultSku });
  }

  if (rows.length > 0 && !rows.some((r) => r.is_default)) {
    return { ok: false, error: "허용한 SKU 중 기본 선택을 하나 지정해주세요." };
  }

  // 구성품과 같은 브랜드·제품종류의 SKU만 허용
  const { data: itemRow } = await db()
    .from("package_items")
    .select("product:products(brand_id, product_type)")
    .eq("id", itemId)
    .single();
  const base = (itemRow as unknown as { product: { brand_id: string; product_type: string } | null } | null)?.product;
  if (!base) return { ok: false, error: "구성품 제품을 찾을 수 없습니다." };
  if (rows.length) {
    const { data: skuRows } = await db()
      .from("product_skus")
      .select("id, model:product_models(product:products(brand_id, product_type))")
      .in("id", rows.map((r) => r.sku_id));
    const okIds = new Set(
      ((skuRows ?? []) as unknown as { id: string; model: { product: { brand_id: string; product_type: string } | null } | null }[])
        .filter((s) => s.model?.product?.brand_id === base.brand_id && s.model?.product?.product_type === base.product_type)
        .map((s) => s.id)
    );
    if (rows.some((r) => !okIds.has(r.sku_id))) {
      return { ok: false, error: "구성품과 브랜드·제품종류가 같은 SKU만 허용할 수 있습니다." };
    }
  }

  const sb = db();
  const { error: delErr } = await sb.from("package_item_skus").delete().eq("package_item_id", itemId);
  if (delErr) return fail(delErr);
  if (rows.length) {
    const { error } = await sb.from("package_item_skus").insert(rows);
    if (error) return fail(error);
  }
  await log(staff.id, "save_package_item_skus", itemId, { count: rows.length, default: defaultSku });
  return done(`허용 SKU ${rows.length}개가 저장되었습니다.`);
}