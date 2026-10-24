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

// ---------- 일반 쇼핑몰 ----------
const STORE_KEYS = ["video", "kitchen", "laundry", "air", "life"];

export async function updateStoreSettings(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const visible = bool(fd, "store_visible");
  const category = str(fd, "store_category");
  if (category && !STORE_KEYS.includes(category)) return { ok: false, error: "분류를 확인해주세요." };
  if (visible && !category) return { ok: false, error: "쇼핑몰에 노출하려면 분류를 선택해주세요." };

  const thumb = str(fd, "store_thumbnail");
  if (thumb) {
    try {
      if (new URL(thumb).protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, error: "대표 이미지는 https:// 주소로 입력해주세요." };
    }
  }

  const fields = {
    store_visible: visible,
    store_category: category || null,
    bundle_eligible: bool(fd, "bundle_eligible"),
    store_thumbnail: thumb || null,
    store_summary: str(fd, "store_summary").slice(0, 200) || null,
  };
  const { error } = await db().from("products").update(fields).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_store_settings", id, fields);
  revalidatePath("/", "layout");
  return { ok: true, message: "저장되었습니다." };
}

/** SKU별 정상가·판매가 일괄 저장. 판매가를 비우면 쇼핑몰 판매 안 함 */
export async function saveStorePrices(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const productId = str(fd, "product_id");
  if (!uuid.safeParse(productId).success) return { ok: false, error: "잘못된 요청입니다." };

  const skuIds = fd.getAll("sku_id").map(String).filter((v) => uuid.safeParse(v).success);
  const upserts: { sku_id: string; list_price: number; sale_price: number; is_active: boolean }[] = [];
  const removes: string[] = [];

  for (const skuId of skuIds) {
    const saleRaw = str(fd, `sale:${skuId}`);
    const listRaw = str(fd, `list:${skuId}`);
    if (!saleRaw) {
      removes.push(skuId);
      continue;
    }
    const sale = num(fd, `sale:${skuId}`);
    const list = listRaw ? num(fd, `list:${skuId}`) : sale;
    if (!Number.isInteger(sale) || sale <= 0) return { ok: false, error: "판매가는 0보다 큰 숫자로 입력해주세요." };
    if (!Number.isInteger(list) || list < sale) return { ok: false, error: "정상가는 판매가 이상이어야 합니다." };
    upserts.push({ sku_id: skuId, list_price: list, sale_price: sale, is_active: bool(fd, `active:${skuId}`) });
  }

  const sb = db();
  if (upserts.length) {
    const { error } = await sb.from("store_prices").upsert(upserts);
    if (error) return fail(error);
  }
  if (removes.length) {
    const { error } = await sb.from("store_prices").delete().in("sku_id", removes);
    if (error) return fail(error);
  }
  await log(staff.id, "save_store_prices", productId, { priced: upserts.length, removed: removes.length });
  revalidatePath("/", "layout");
  return { ok: true, message: `판매가 ${upserts.length}개가 저장되었습니다.` };
}

// ---------- 간편 등록 (제품 1 = 모델 1 = SKU 1) ----------
export async function quickCreateProduct(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const sb = db();

  const brandId = str(fd, "brand_id");
  const productType = str(fd, "product_type");
  const name = str(fd, "name");
  const modelCode = str(fd, "model_code").toUpperCase();
  const modelName = str(fd, "model_name") || name;
  const stock = num(fd, "stock");
  const saleRaw = str(fd, "sale_price");
  const listRaw = str(fd, "list_price");
  const sale = saleRaw ? num(fd, "sale_price") : null;
  const list = listRaw ? num(fd, "list_price") : null;
  const category = str(fd, "store_category");
  const visible = bool(fd, "store_visible");
  const image = str(fd, "image_url");

  if (!uuid.safeParse(brandId).success) return { ok: false, error: "브랜드를 선택해주세요." };
  if (!productType) return { ok: false, error: "제품종류를 입력해주세요." };
  if (!name || name.length > 100) return { ok: false, error: "제품명을 입력해주세요. (100자 이내)" };
  if (!modelCode) return { ok: false, error: "모델코드를 입력해주세요." };
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: "재고는 0 이상의 숫자로 입력해주세요." };
  if (sale !== null && (!Number.isInteger(sale) || sale <= 0)) return { ok: false, error: "판매가를 확인해주세요." };
  if (list !== null && (!Number.isInteger(list) || (sale !== null && list < sale))) return { ok: false, error: "정상가는 판매가 이상이어야 합니다." };
  if (category && !STORE_KEYS.includes(category)) return { ok: false, error: "분류를 확인해주세요." };
  if (visible && (!category || sale === null)) return { ok: false, error: "쇼핑몰에 노출하려면 분류와 판매가가 필요합니다." };
  if (image) {
    try {
      if (new URL(image).protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, error: "이미지 주소는 https:// 로 입력해주세요." };
    }
  }

  // SKU코드: 비우면 DT-브랜드-모델코드
  const { data: brand } = await sb.from("brands").select("slug").eq("id", brandId).single();
  const prefix = brand?.slug === "samsung" ? "SS" : brand?.slug === "lg" ? "LG" : String(brand?.slug ?? "BR").slice(0, 4).toUpperCase();
  const sku = (str(fd, "sku") || `DT-${prefix}-${modelCode}`).toUpperCase().replace(/[^A-Z0-9\-_]/g, "-");
  if (!/^[A-Z0-9\-_]{3,60}$/.test(sku)) return { ok: false, error: "SKU코드를 확인해주세요." };

  // 같은 브랜드에 같은 제품명이 있으면 막기 (중복 등록 방지)
  const { data: dup } = await sb.from("products").select("id").eq("brand_id", brandId).eq("name", name).maybeSingle();
  if (dup) return { ok: false, error: "같은 브랜드에 같은 제품명이 이미 있습니다." };
  const { data: dupSku } = await sb.from("product_skus").select("id").eq("sku", sku).maybeSingle();
  if (dupSku) return { ok: false, error: `SKU코드 ${sku}가 이미 사용 중입니다.` };

  const { data: product, error: pErr } = await sb
    .from("products")
    .insert({
      brand_id: brandId,
      product_type: productType,
      name,
      attribute_keys: [],
      status: "active",
      store_visible: visible,
      store_category: category || null,
      bundle_eligible: bool(fd, "bundle_eligible"),
      store_thumbnail: image || null,
      store_summary: str(fd, "store_summary").slice(0, 200) || null,
    })
    .select("id")
    .single();
  if (pErr || !product) return fail(pErr ?? { message: "product insert failed" });

  // 이후 단계가 실패하면 만든 제품을 지워 원상복구
  const rollback = async (e: { code?: string; message: string }) => {
    await sb.from("products").delete().eq("id", product.id);
    return fail(e);
  };

  const { data: model, error: mErr } = await sb
    .from("product_models")
    .insert({ product_id: product.id, model_code: modelCode, model_name: modelName, image_url: image || null })
    .select("id")
    .single();
  if (mErr || !model) return rollback(mErr ?? { message: "model insert failed" });

  const { data: skuRow, error: sErr } = await sb
    .from("product_skus")
    .insert({ model_id: model.id, sku, attributes: {}, stock, status: "active" })
    .select("id")
    .single();
  if (sErr || !skuRow) return rollback(sErr ?? { message: "sku insert failed" });

  if (sale !== null) {
    const { error } = await sb.from("store_prices").insert({ sku_id: skuRow.id, list_price: list ?? sale, sale_price: sale, is_active: true });
    if (error) return rollback(error);
  }

  await log(staff.id, "quick_create_product", product.id, { name, sku });
  revalidatePath("/", "layout");
  return { ok: true, message: `등록되었습니다: ${name} (${sku})` };
}

// ---------- 목록에서 쇼핑몰 노출 전환 ----------
export async function toggleStoreVisible(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  const next = str(fd, "visible") === "1";
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  if (next) {
    const { data } = await db()
      .from("products")
      .select("store_category, product_models(product_skus(store_prices(is_active)))")
      .eq("id", id)
      .single();
    const p = data as unknown as {
      store_category: string | null;
      product_models: { product_skus: { store_prices: { is_active: boolean } | { is_active: boolean }[] | null }[] }[];
    } | null;
    const hasPrice = (p?.product_models ?? []).some((m) =>
      m.product_skus.some((s) => {
        const pr = Array.isArray(s.store_prices) ? s.store_prices[0] : s.store_prices;
        return !!pr?.is_active;
      })
    );
    if (!p?.store_category) return { ok: false, error: "분류 없음" };
    if (!hasPrice) return { ok: false, error: "판매가 없음" };
  }

  const { error } = await db().from("products").update({ store_visible: next }).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "toggle_store_visible", id, { visible: next });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- 상세: 기본 정보 + 쇼핑몰 설정 한 번에 ----------
export async function updateProductAll(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const id = str(fd, "id");
  if (!uuid.safeParse(id).success) return { ok: false, error: "잘못된 요청입니다." };

  const productType = str(fd, "product_type");
  const name = str(fd, "name");
  if (!productType) return { ok: false, error: "제품종류를 입력해주세요." };
  if (!name || name.length > 100) return { ok: false, error: "제품명을 입력해주세요. (100자 이내)" };

  const keys = parseKeys(str(fd, "attribute_keys"));
  if (keys.length > 5) return { ok: false, error: "선택 항목은 최대 5개입니다." };

  const category = str(fd, "store_category");
  if (category && !STORE_KEYS.includes(category)) return { ok: false, error: "분류를 확인해주세요." };
  const visible = bool(fd, "store_visible");

  const thumb = str(fd, "store_thumbnail");
  if (thumb && !/^\/images\/[\w\-/.]+$/.test(thumb)) {
    try {
      if (new URL(thumb).protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, error: "대표 이미지는 https:// 주소로 입력해주세요." };
    }
  }

  if (visible) {
    if (!category) return { ok: false, error: "쇼핑몰에 노출하려면 분류를 선택해주세요." };
    const { data } = await db()
      .from("product_models")
      .select("product_skus(store_prices(is_active))")
      .eq("product_id", id);
    type P = { is_active: boolean };
    const hasPrice = ((data ?? []) as unknown as { product_skus: { store_prices: P | P[] | null }[] }[]).some((m) =>
      m.product_skus.some((s) => (Array.isArray(s.store_prices) ? s.store_prices[0] : s.store_prices)?.is_active)
    );
    if (!hasPrice) return { ok: false, error: "쇼핑몰에 노출하려면 판매·재고 탭에서 판매가를 먼저 입력해주세요." };
  }

  const fields = {
    product_type: productType,
    name,
    attribute_keys: keys,
    status: str(fd, "status") === "inactive" ? "inactive" : "active",
    description: str(fd, "description").slice(0, 5000) || null,
    store_visible: visible,
    store_category: category || null,
    bundle_eligible: bool(fd, "bundle_eligible"),
    store_thumbnail: thumb || null,
    store_summary: str(fd, "store_summary").slice(0, 200) || null,
  };
  const { error } = await db().from("products").update(fields).eq("id", id);
  if (error) return fail(error);
  await log(staff.id, "update_product_all", id, fields);
  revalidatePath("/", "layout");
  return { ok: true, message: "저장되었습니다." };
}

// ---------- 상세: SKU 재고·판매상태·가격 한 표 저장 ----------
export async function saveSkuTable(fd: FormData): Promise<ActionResult> {
  const staff = await requireStaff("products");
  const productId = str(fd, "product_id");
  if (!uuid.safeParse(productId).success) return { ok: false, error: "잘못된 요청입니다." };

  // 이 제품의 SKU만 처리
  const { data: own } = await db()
    .from("product_skus")
    .select("id, sku, model:product_models!inner(product_id)")
    .eq("model.product_id", productId);
  const ownIds = new Map(((own ?? []) as { id: string; sku: string }[]).map((s) => [s.id, s.sku]));

  const skuUpdates: { id: string; stock: number; status: string }[] = [];
  const priceUpserts: { sku_id: string; list_price: number; sale_price: number; is_active: boolean }[] = [];
  const priceRemoves: string[] = [];

  for (const skuId of fd.getAll("sku_id").map(String)) {
    const code = ownIds.get(skuId);
    if (!code) continue;
    const stock = num(fd, `stock:${skuId}`);
    const status = ["active", "soldout", "inactive"].includes(str(fd, `status:${skuId}`)) ? str(fd, `status:${skuId}`) : "active";
    if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: `${code}: 재고는 0 이상의 숫자입니다.` };
    skuUpdates.push({ id: skuId, stock, status });

    const saleRaw = str(fd, `sale:${skuId}`);
    const listRaw = str(fd, `list:${skuId}`);
    if (!saleRaw) {
      priceRemoves.push(skuId);
      continue;
    }
    const sale = num(fd, `sale:${skuId}`);
    const list = listRaw ? num(fd, `list:${skuId}`) : sale;
    if (!Number.isInteger(sale) || sale <= 0) return { ok: false, error: `${code}: 판매가를 확인해주세요.` };
    if (!Number.isInteger(list) || list < sale) return { ok: false, error: `${code}: 정상가는 판매가 이상이어야 합니다.` };
    priceUpserts.push({ sku_id: skuId, list_price: list, sale_price: sale, is_active: bool(fd, `sell:${skuId}`) });
  }

  const sb = db();
  for (const u of skuUpdates) {
    const { error } = await sb.from("product_skus").update({ stock: u.stock, status: u.status }).eq("id", u.id);
    if (error) return fail(error);
  }
  if (priceUpserts.length) {
    const { error } = await sb.from("store_prices").upsert(priceUpserts, { onConflict: "sku_id" });
    if (error) return fail(error);
  }
  if (priceRemoves.length) {
    const { error } = await sb.from("store_prices").delete().in("sku_id", priceRemoves);
    if (error) return fail(error);
  }

  await log(staff.id, "save_sku_table", productId, { skus: skuUpdates.length, priced: priceUpserts.length, removed: priceRemoves.length });
  revalidatePath("/", "layout");
  return { ok: true, message: `${skuUpdates.length}개 SKU가 저장되었습니다.` };
}