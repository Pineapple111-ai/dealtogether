import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getStaff, can } from "@/lib/auth/staff";
import { runImport } from "@/lib/admin/import";

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || !can(staff.role, "products")) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { apply?: boolean; products?: unknown; options?: unknown } | null;
  const products = Array.isArray(body?.products) ? (body!.products as Record<string, unknown>[]) : [];
  const options = Array.isArray(body?.options) ? (body!.options as Record<string, unknown>[]) : [];
  if (products.length === 0 && options.length === 0) {
    return NextResponse.json({ message: "파일에 데이터가 없습니다." }, { status: 400 });
  }
  if (products.length > 3000 || options.length > 3000) {
    return NextResponse.json({ message: "한 번에 시트당 3,000행까지 올릴 수 있습니다." }, { status: 400 });
  }

  try {
    const result = await runImport(products, options, body?.apply === true, staff.id);
    if (result.applied) revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (e) {
    console.error("일괄 등록 실패", e);
    return NextResponse.json(
      { message: `적용 중 오류가 발생했습니다. 일부만 반영되었을 수 있으니 같은 파일로 다시 적용해주세요. (${(e as Error).message})` },
      { status: 500 }
    );
  }
}