import { createAdminClient } from "@/lib/supabase/admin";

export type ImportIssue = { sheet: string; row: number; message: string };
type Count = { create: number; update: number };
export type ImportSummary = {
  products: Count;
  models: Count;
  skus: Count;
  prices: { set: number; remove: number };
  optionGroups: Count;
  optionValues: Count & { deactivate: number };
};
export type ImportResult = { ok: boolean; applied: boolean; issues: ImportIssue[]; summary: ImportSummary };

type Raw = Record<string, unknown>;

const CAT: Record<string, string> = {
  영상가전: "video", 주방가전: "kitchen", 세탁가전: "laundry", "냉난방·공기": "air", 냉난방공기: "air", 생활가전: "life",
  video: "video", kitchen: "kitchen", laundry: "laundry", air: "air", life: "life",
};
const STATUS: Record<string, string> = {
  판매중: "active", 품절: "soldout", 숨김: "inactive", active: "active", soldout: "soldout", inactive: "inactive",
};

const norm = (r: Raw) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/\s/g, ""), v]));
const s = (v: unknown) => String(v ?? "").trim();
function num(v: unknown): number | null {
  const t = s(v).replace(/[,\s원]/g, "");
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : NaN;
}
function yn(v: unknown): boolean | null | "invalid" {
  const t = s(v).toUpperCase();
  if (!t) return null;
  if (["Y", "YES", "예", "O", "TRUE", "1"].includes(t)) return true;
  if (["N", "NO", "아니오", "X", "FALSE", "0"].includes(t)) return false;
  return "invalid";
}
function httpsUrl(v: unknown): string | null | "invalid" {
  const t = s(v);
  if (!t) return null;
  try {
    return new URL(t).protocol === "https:" ? t : "invalid";
  } catch {
    return "invalid";
  }
}
function chunk<T>(a: T[], size = 200) {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
  return out;
}

type PRow = {
  row: number; brandId: string; name: string; type: string; keys: string[];
  modelCode: string; modelName: string; sku: string; values: string[];
  stock: number; list: number | null; sale: number | null; status: string | null;
  category: string | null; visible: boolean | null; bundle: boolean | null;
  modelImage: string | null; thumb: string | null; summary: string | null; desc: string | null;
};

type PGroup = {
  key: string; brandId: string; name: string; type: string; keys: string[]; rows: PRow[];
  category: string | null; visible: boolean | null; bundle: boolean | null;
  thumb: string | null; summary: string | null; desc: string | null; firstRow: number;
};

type OVal = { row: number; label: string; price: number; isDefault: boolean; quote: boolean };
type OGroup = { name: string; multi: boolean; required: boolean; values: OVal[]; firstRow: number };

export async function runImport(rawProducts: Raw[], rawOptions: Raw[], apply: boolean, adminId: string): Promise<ImportResult> {
  const db = createAdminClient();
  const issues: ImportIssue[] = [];
  const add = (sheet: string, row: number, message: string) => issues.push({ sheet, row, message });
  const summary: ImportSummary = {
    products: { create: 0, update: 0 },
    models: { create: 0, update: 0 },
    skus: { create: 0, update: 0 },
    prices: { set: 0, remove: 0 },
    optionGroups: { create: 0, update: 0 },
    optionValues: { create: 0, update: 0, deactivate: 0 },
  };

  const { data: brands } = await db.from("brands").select("id, name, slug");
  const brandId = (v: string) =>
    (brands ?? []).find((b) => b.name === v || String(b.slug).toLowerCase() === v.toLowerCase())?.id ?? null;

  // ---------------- 상품 시트 ----------------
  const prows: PRow[] = [];
  rawProducts.forEach((raw, i) => {
    const r = norm(raw);
    const row = i + 2;
    if (Object.values(r).every((v) => s(v) === "")) return;

    const brand = s(r["브랜드"]);
    const bId = brandId(brand);
    const type = s(r["제품종류"]);
    const name = s(r["제품명"]);
    const keys = s(r["선택항목"]).split("|").map((x) => x.trim()).filter(Boolean);
    const values = s(r["옵션값"]).split("|").map((x) => x.trim()).filter(Boolean);
    const modelCode = s(r["모델코드"]).toUpperCase();
    const modelName = s(r["모델명"]);
    const sku = s(r["SKU코드"]).toUpperCase();
    const stock = num(r["재고"]);
    const list = num(r["정상가"]);
    const sale = num(r["판매가"]);
    const statusRaw = s(r["판매상태"]);
    const catRaw = s(r["쇼핑몰분류"]);
    const visible = yn(r["쇼핑몰노출"]);
    const bundle = yn(r["세트할인"]);
    const modelImage = httpsUrl(r["모델이미지"]);
    const thumb = httpsUrl(r["대표이미지"]);

    const errs: string[] = [];
    if (!bId) errs.push(`브랜드 '${brand}'를 찾을 수 없습니다 (등록된 브랜드명으로 입력)`);
    if (!type) errs.push("제품종류가 비어 있습니다");
    if (!name) errs.push("제품명이 비어 있습니다");
    if (keys.length > 5) errs.push("선택항목은 최대 5개입니다");
    if (!modelCode) errs.push("모델코드가 비어 있습니다");
    if (!modelName) errs.push("모델명이 비어 있습니다");
    if (!/^[A-Z0-9\-_]{3,60}$/.test(sku)) errs.push("SKU코드는 영문 대문자·숫자·하이픈 3~60자입니다");
    if (values.length !== keys.length) errs.push(`옵션값 개수(${values.length})가 선택항목 개수(${keys.length})와 다릅니다`);
    if (stock === null || !Number.isInteger(stock) || stock < 0) errs.push("재고는 0 이상의 정수입니다");
    if (sale !== null && (!Number.isInteger(sale) || sale < 0)) errs.push("판매가를 숫자로 입력해주세요");
    if (list !== null && (!Number.isInteger(list) || list < 0)) errs.push("정상가를 숫자로 입력해주세요");
    if (sale && list !== null && list < sale) errs.push("정상가는 판매가 이상이어야 합니다");
    if (statusRaw && !STATUS[statusRaw]) errs.push("판매상태는 판매중 / 품절 / 숨김 중 하나입니다");
    if (catRaw && !CAT[catRaw]) errs.push("쇼핑몰분류는 영상가전 / 주방가전 / 세탁가전 / 냉난방·공기 / 생활가전 중 하나입니다");
    if (visible === "invalid") errs.push("쇼핑몰노출은 Y 또는 N입니다");
    if (bundle === "invalid") errs.push("세트할인은 Y 또는 N입니다");
    if (modelImage === "invalid") errs.push("모델이미지는 https:// 주소입니다");
    if (thumb === "invalid") errs.push("대표이미지는 https:// 주소입니다");
    if (errs.length) {
      errs.forEach((m) => add("상품", row, m));
      return;
    }

    prows.push({
      row, brandId: bId!, name, type, keys, modelCode, modelName, sku, values,
      stock: stock!, list, sale, status: statusRaw ? STATUS[statusRaw] : null,
      category: catRaw ? CAT[catRaw] : null,
      visible: visible as boolean | null, bundle: bundle as boolean | null,
      modelImage: modelImage as string | null, thumb: thumb as string | null,
      summary: s(r["요약"]).slice(0, 200) || null, desc: s(r["설명"]).slice(0, 5000) || null,
    });
  });

  // 제품 단위 묶기 + 일관성
  const groups = new Map<string, PGroup>();
  const skuSeen = new Map<string, number>();
  const modelNames = new Map<string, string>();
  for (const r of prows) {
    const key = `${r.brandId}|${r.name}`;
    if (skuSeen.has(r.sku)) add("상품", r.row, `SKU코드 ${r.sku}가 ${skuSeen.get(r.sku)}행과 중복됩니다`);
    skuSeen.set(r.sku, r.row);

    const mKey = `${key}|${r.modelCode}`;
    const prevName = modelNames.get(mKey);
    if (prevName && prevName !== r.modelName) add("상품", r.row, `같은 모델코드(${r.modelCode})의 모델명이 앞 행과 다릅니다`);
    modelNames.set(mKey, r.modelName);

    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key, brandId: r.brandId, name: r.name, type: r.type, keys: r.keys, rows: [r],
        category: r.category, visible: r.visible, bundle: r.bundle, thumb: r.thumb, summary: r.summary, desc: r.desc,
        firstRow: r.row,
      });
      continue;
    }
    if (g.type !== r.type) add("상품", r.row, "같은 제품의 제품종류가 앞 행과 다릅니다");
    if (g.keys.join("|") !== r.keys.join("|")) add("상품", r.row, "같은 제품의 선택항목이 앞 행과 다릅니다");
    g.category ??= r.category;
    g.visible ??= r.visible;
    g.bundle ??= r.bundle;
    g.thumb ??= r.thumb;
    g.summary ??= r.summary;
    g.desc ??= r.desc;
    g.rows.push(r);
  }

  // ---------------- 옵션 시트 (파싱) ----------------
  type ORowParsed = { row: number; key: string; group: string; multi: boolean; required: boolean; val: OVal };
  const orows: ORowParsed[] = [];
  rawOptions.forEach((raw, i) => {
    const r = norm(raw);
    const row = i + 2;
    if (Object.values(r).every((v) => s(v) === "")) return;

    const brand = s(r["브랜드"]);
    const bId = brandId(brand);
    const name = s(r["제품명"]);
    const group = s(r["옵션그룹"]);
    const typeRaw = s(r["선택방식"]);
    const required = yn(r["필수"]);
    const label = s(r["옵션명"]);
    const price = num(r["추가금"]) ?? 0;
    const isDefault = yn(r["기본선택"]);
    const quote = yn(r["현장견적"]);

    const errs: string[] = [];
    if (!bId) errs.push(`브랜드 '${brand}'를 찾을 수 없습니다`);
    if (!name) errs.push("제품명이 비어 있습니다");
    if (!group || group.length > 30) errs.push("옵션그룹을 입력해주세요 (30자 이내)");
    if (!["단일", "복수", ""].includes(typeRaw)) errs.push("선택방식은 단일 또는 복수입니다");
    if (required === "invalid" || isDefault === "invalid" || quote === "invalid") errs.push("필수·기본선택·현장견적은 Y 또는 N입니다");
    if (!label || label.length > 40) errs.push("옵션명을 입력해주세요 (40자 이내)");
    if (!Number.isInteger(price) || price < 0) errs.push("추가금은 0 이상의 숫자입니다");
    if (errs.length) {
      errs.forEach((m) => add("옵션", row, m));
      return;
    }
    orows.push({
      row, key: `${bId}|${name}`, group, multi: typeRaw === "복수", required: required === true,
      val: { row, label, price, isDefault: isDefault === true, quote: quote === true },
    });
  });

  // ---------------- 기존 데이터 조회 ----------------
  const names = [...new Set([...[...groups.values()].map((g) => g.name), ...orows.map((o) => o.key.split("|").slice(1).join("|"))])];
  const existingProducts = new Map<string, { id: string; store_category: string | null }>();
  for (const part of chunk(names)) {
    const { data } = await db.from("products").select("id, brand_id, name, store_category").in("name", part);
    for (const p of data ?? []) existingProducts.set(`${p.brand_id}|${p.name}`, { id: p.id, store_category: p.store_category });
  }

  const productIds = [...existingProducts.values()].map((p) => p.id);
  const existingModels = new Map<string, { id: string; image_url: string | null }>(); // productId|code
  for (const part of chunk(productIds)) {
    const { data } = await db.from("product_models").select("id, product_id, model_code, image_url").in("product_id", part);
    for (const m of data ?? []) existingModels.set(`${m.product_id}|${m.model_code}`, { id: m.id, image_url: m.image_url });
  }

  const existingSkus = new Map<string, { id: string; status: string; productId: string; modelCode: string }>();
  for (const part of chunk([...skuSeen.keys()])) {
    const { data } = await db
      .from("product_skus")
      .select("id, sku, status, model:product_models(product_id, model_code)")
      .in("sku", part);
    for (const k of (data ?? []) as unknown as { id: string; sku: string; status: string; model: { product_id: string; model_code: string } }[]) {
      existingSkus.set(k.sku, { id: k.id, status: k.status, productId: k.model.product_id, modelCode: k.model.model_code });
    }
  }

  // SKU가 다른 제품·모델에 이미 있는지 + 쇼핑몰 노출 시 분류 필수
  for (const g of groups.values()) {
    const ex = existingProducts.get(g.key);
    if (g.visible === true && !(g.category ?? ex?.store_category)) {
      add("상품", g.firstRow, `${g.name}: 쇼핑몰노출 Y인 경우 쇼핑몰분류가 필요합니다`);
    }
    for (const r of g.rows) {
      const es = existingSkus.get(r.sku);
      if (es && (!ex || es.productId !== ex.id || es.modelCode !== r.modelCode)) {
        add("상품", r.row, `SKU코드 ${r.sku}는 다른 제품·모델에 이미 등록되어 있습니다`);
      }
    }
  }

  // ---------------- 옵션 묶기 + 검증 ----------------
  const optByProduct = new Map<string, Map<string, OGroup>>();
  for (const o of orows) {
    if (!groups.has(o.key) && !existingProducts.has(o.key)) {
      add("옵션", o.row, "상품 시트나 기존 등록 제품에서 찾을 수 없는 제품입니다 (브랜드·제품명 확인)");
      continue;
    }
    const m = optByProduct.get(o.key) ?? new Map<string, OGroup>();
    optByProduct.set(o.key, m);
    const g = m.get(o.group);
    if (!g) {
      m.set(o.group, { name: o.group, multi: o.multi, required: o.required, values: [o.val], firstRow: o.row });
      continue;
    }
    if (g.multi !== o.multi || g.required !== o.required) add("옵션", o.row, `옵션그룹 '${o.group}'의 선택방식·필수 값이 앞 행과 다릅니다`);
    if (g.values.some((v) => v.label === o.val.label)) add("옵션", o.row, `옵션명 '${o.val.label}'이 같은 그룹에 중복됩니다`);
    g.values.push(o.val);
  }
  for (const m of optByProduct.values()) {
    for (const g of m.values()) {
      if (!g.multi && g.values.filter((v) => v.isDefault).length > 1) {
        add("옵션", g.firstRow, `'${g.name}'은 단일 선택이라 기본선택은 하나만 가능합니다`);
      }
    }
  }

  const existingAddon = new Map<string, { id: string; values: { id: string; label: string }[] }[]>(); // productId → groups
  const optProductIds = [...optByProduct.keys()].map((k) => existingProducts.get(k)?.id).filter((x): x is string => !!x);
  const groupNameMap = new Map<string, Map<string, { id: string; values: { id: string; label: string }[] }>>();
  for (const part of chunk(optProductIds)) {
    const { data } = await db.from("addon_groups").select("id, product_id, name, addon_values(id, label)").in("product_id", part);
    for (const g of (data ?? []) as { id: string; product_id: string; name: string; addon_values: { id: string; label: string }[] }[]) {
      const list = existingAddon.get(g.product_id) ?? [];
      list.push({ id: g.id, values: g.addon_values });
      existingAddon.set(g.product_id, list);
      const nm = groupNameMap.get(g.product_id) ?? new Map();
      nm.set(g.name, { id: g.id, values: g.addon_values });
      groupNameMap.set(g.product_id, nm);
    }
  }

  // ---------------- 건수 집계 ----------------
  for (const g of groups.values()) {
    const ex = existingProducts.get(g.key);
    if (ex) summary.products.update++;
    else summary.products.create++;
    const codes = new Set(g.rows.map((r) => r.modelCode));
    for (const c of codes) {
      if (ex && existingModels.has(`${ex.id}|${c}`)) summary.models.update++;
      else summary.models.create++;
    }
    for (const r of g.rows) {
      if (existingSkus.has(r.sku)) summary.skus.update++;
      else summary.skus.create++;
      if (r.sale && r.sale > 0) summary.prices.set++;
      else if (r.sale === 0) summary.prices.remove++;
    }
  }
  for (const [key, m] of optByProduct) {
    const pid = existingProducts.get(key)?.id;
    const exGroups = pid ? groupNameMap.get(pid) : undefined;
    for (const g of m.values()) {
      const exg = exGroups?.get(g.name);
      if (exg) summary.optionGroups.update++;
      else summary.optionGroups.create++;
      for (const v of g.values) {
        if (exg?.values.some((x) => x.label === v.label)) summary.optionValues.update++;
        else summary.optionValues.create++;
      }
      if (exg) summary.optionValues.deactivate += exg.values.filter((x) => !g.values.some((v) => v.label === x.label)).length;
    }
    if (exGroups) {
      for (const [name, exg] of exGroups) if (!m.has(name)) summary.optionValues.deactivate += exg.values.length;
    }
  }

  if (issues.length) return { ok: false, applied: false, issues: issues.slice(0, 300), summary };
  if (!apply) return { ok: true, applied: false, issues, summary };

  // ================= 적용 =================
  // 1. 제품
  const productIdByKey = new Map<string, string>();
  for (const [k, v] of existingProducts) productIdByKey.set(k, v.id);

  const newProducts = [...groups.values()].filter((g) => !existingProducts.has(g.key));
  for (const part of chunk(newProducts)) {
    const { data, error } = await db
      .from("products")
      .insert(
        part.map((g) => ({
          brand_id: g.brandId, product_type: g.type, name: g.name, attribute_keys: g.keys, description: g.desc,
          status: "active", store_visible: g.visible ?? false, store_category: g.category,
          bundle_eligible: g.bundle ?? true, store_thumbnail: g.thumb, store_summary: g.summary,
        }))
      )
      .select("id, brand_id, name");
    if (error) throw new Error(`제품 등록 실패: ${error.message}`);
    for (const p of data ?? []) productIdByKey.set(`${p.brand_id}|${p.name}`, p.id);
  }
  for (const g of groups.values()) {
    const ex = existingProducts.get(g.key);
    if (!ex) continue;
    const { error } = await db
      .from("products")
      .update({
        product_type: g.type,
        attribute_keys: g.keys,
        ...(g.desc !== null && { description: g.desc }),
        ...(g.visible !== null && { store_visible: g.visible }),
        ...(g.category !== null && { store_category: g.category }),
        ...(g.bundle !== null && { bundle_eligible: g.bundle }),
        ...(g.thumb !== null && { store_thumbnail: g.thumb }),
        ...(g.summary !== null && { store_summary: g.summary }),
      })
      .eq("id", ex.id);
    if (error) throw new Error(`제품 수정 실패(${g.name}): ${error.message}`);
  }

  // 2. 모델 (제품+모델코드 기준 upsert)
  const modelRows: { product_id: string; model_code: string; model_name: string; image_url: string | null }[] = [];
  for (const g of groups.values()) {
    const pid = productIdByKey.get(g.key)!;
    const seen = new Set<string>();
    for (const r of g.rows) {
      if (seen.has(r.modelCode)) continue;
      seen.add(r.modelCode);
      const img = g.rows.find((x) => x.modelCode === r.modelCode && x.modelImage)?.modelImage;
      modelRows.push({
        product_id: pid,
        model_code: r.modelCode,
        model_name: r.modelName,
        image_url: img ?? existingModels.get(`${pid}|${r.modelCode}`)?.image_url ?? null,
      });
    }
  }
  const modelIdByKey = new Map<string, string>();
  for (const part of chunk(modelRows)) {
    const { data, error } = await db
      .from("product_models")
      .upsert(part, { onConflict: "product_id,model_code" })
      .select("id, product_id, model_code");
    if (error) throw new Error(`모델 저장 실패: ${error.message}`);
    for (const m of data ?? []) modelIdByKey.set(`${m.product_id}|${m.model_code}`, m.id);
  }

  // 3. SKU (SKU코드 기준 upsert, 재고 덮어쓰기)
  const skuRows: { model_id: string; sku: string; attributes: Record<string, string>; stock: number; status: string }[] = [];
  for (const g of groups.values()) {
    const pid = productIdByKey.get(g.key)!;
    for (const r of g.rows) {
      skuRows.push({
        model_id: modelIdByKey.get(`${pid}|${r.modelCode}`)!,
        sku: r.sku,
        attributes: Object.fromEntries(g.keys.map((k, i) => [k, r.values[i]])),
        stock: r.stock,
        status: r.status ?? existingSkus.get(r.sku)?.status ?? "active",
      });
    }
  }
  const skuIdByCode = new Map<string, string>();
  for (const part of chunk(skuRows)) {
    const { data, error } = await db.from("product_skus").upsert(part, { onConflict: "sku" }).select("id, sku");
    if (error) throw new Error(`SKU 저장 실패: ${error.message}`);
    for (const k of data ?? []) skuIdByCode.set(k.sku, k.id);
  }

  // 4. 쇼핑몰 판매가
  const priceRows: { sku_id: string; list_price: number; sale_price: number; is_active: boolean }[] = [];
  const removeIds: string[] = [];
  for (const r of prows) {
    const id = skuIdByCode.get(r.sku);
    if (!id) continue;
    if (r.sale && r.sale > 0) priceRows.push({ sku_id: id, list_price: r.list ?? r.sale, sale_price: r.sale, is_active: true });
    else if (r.sale === 0) removeIds.push(id);
  }
  for (const part of chunk(priceRows)) {
    const { error } = await db.from("store_prices").upsert(part, { onConflict: "sku_id" });
    if (error) throw new Error(`판매가 저장 실패: ${error.message}`);
  }
  for (const part of chunk(removeIds)) {
    await db.from("store_prices").delete().in("sku_id", part);
  }

  // 5. 부가 옵션
  for (const [key, m] of optByProduct) {
    const pid = productIdByKey.get(key);
    if (!pid) continue;
    const exGroups = groupNameMap.get(pid) ?? new Map<string, { id: string; values: { id: string; label: string }[] }>();
    let gOrder = 0;
    for (const g of m.values()) {
      gOrder++;
      const groupFields = {
        name: g.name,
        select_type: g.multi ? "multi" : "single",
        ui_type: g.multi ? "checkbox" : "radio",
        is_required: g.required,
        sort_order: gOrder,
      };
      let groupId = exGroups.get(g.name)?.id;
      if (groupId) {
        await db.from("addon_groups").update(groupFields).eq("id", groupId);
      } else {
        const { data, error } = await db.from("addon_groups").insert({ ...groupFields, product_id: pid }).select("id").single();
        if (error || !data) throw new Error(`옵션그룹 저장 실패(${g.name}): ${error?.message}`);
        groupId = data.id;
      }
      const exValues = exGroups.get(g.name)?.values ?? [];
      let vOrder = 0;
      for (const v of g.values) {
        vOrder++;
        const fields = { label: v.label, price: v.price, is_default: v.isDefault, is_quote_required: v.quote, is_active: true, sort_order: vOrder };
        const exv = exValues.find((x) => x.label === v.label);
        if (exv) await db.from("addon_values").update(fields).eq("id", exv.id);
        else await db.from("addon_values").insert({ ...fields, group_id: groupId });
      }
      const drop = exValues.filter((x) => !g.values.some((v) => v.label === x.label)).map((x) => x.id);
      if (drop.length) await db.from("addon_values").update({ is_active: false }).in("id", drop);
    }
    // 파일에 없는 기존 그룹 → 옵션 숨김
    for (const [name, exg] of exGroups) {
      if (!m.has(name) && exg.values.length) {
        await db.from("addon_values").update({ is_active: false }).in("id", exg.values.map((x) => x.id));
      }
    }
  }

  await db.from("admin_activity_logs").insert({
    admin_id: adminId, action: "bulk_import_products", target_type: "product", target_id: "import", detail: summary,
  });

  return { ok: true, applied: true, issues: [], summary };
}