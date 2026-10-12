import { createClient } from "@supabase/supabase-js";

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getBrands() {
  const { data } = await publicClient()
    .from("brands")
    .select("id, name, slug, theme_color")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getBrandBySlug(slug: string) {
  const { data } = await publicClient()
    .from("brands")
    .select("id, name, slug, theme_color")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getCategoryBySlug(slug: string) {
  const { data } = await publicClient()
    .from("categories")
    .select("id, name, slug, image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

/** 제품명·모델명·모델코드로 패키지 찾기 */
export async function searchPackageIds(q: string): Promise<Set<string>> {
  const safe = q.replace(/[%_,().*]/g, "").trim();
  if (!safe) return new Set();
  const like = `%${safe}%`;
  const sb = publicClient();

  const [products, models] = await Promise.all([
    sb.from("products").select("id").ilike("name", like),
    sb.from("product_models").select("product_id").or(`model_name.ilike.${like},model_code.ilike.${like}`),
  ]);

  const productIds = [
    ...new Set([
      ...(products.data ?? []).map((p) => p.id as string),
      ...(models.data ?? []).map((m) => m.product_id as string),
    ]),
  ];
  if (productIds.length === 0) return new Set();

  const { data } = await sb.from("package_items").select("package_id").in("product_id", productIds);
  return new Set((data ?? []).map((r) => r.package_id as string));
}