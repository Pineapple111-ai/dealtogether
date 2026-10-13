import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreProductsByIds, getActiveDiscountRules } from "@/lib/queries/store";
import { computeStoreQuote } from "@/lib/store-pricing";

export const cartSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      productId: z.string().uuid(),
      skuId: z.string().uuid(),
      addons: z.record(z.string(), z.array(z.string().uuid()).max(10)),
      quantity: z.number().int().min(1).max(10),
    })
  )
  .min(1)
  .max(50);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const parsed = cartSchema.safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ message: "장바구니 정보가 올바르지 않습니다." }, { status: 400 });

  const admin = createAdminClient();
  const [products, rules, { data: site }] = await Promise.all([
    getStoreProductsByIds([...new Set(parsed.data.map((i) => i.productId))]),
    getActiveDiscountRules(),
    admin.from("site_settings").select("bundle_max_rate").eq("id", 1).single(),
  ]);

  return NextResponse.json(
    computeStoreQuote(products, parsed.data, rules, Number(site?.bundle_max_rate ?? 10))
  );
}