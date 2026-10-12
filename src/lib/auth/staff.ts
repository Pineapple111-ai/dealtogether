import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffRole = "super_admin" | "product_admin" | "order_admin" | "cs";
export type StaffArea = "dashboard" | "orders" | "campaigns" | "products" | "members" | "cs" | "content" | "settings";

export type Staff = { id: string; name: string | null; email: string | null; role: StaffRole };

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "최고 관리자",
  product_admin: "상품 관리자",
  order_admin: "주문 관리자",
  cs: "상담 담당자",
};

const ACCESS: Record<StaffRole, StaffArea[]> = {
  super_admin: ["dashboard", "orders", "campaigns", "products", "members", "cs", "content", "settings"],
  product_admin: ["dashboard", "campaigns", "products", "content"],
  order_admin: ["dashboard", "orders", "members"],
  cs: ["dashboard", "cs", "orders"],
};

export function can(role: StaffRole, area: StaffArea) {
  return ACCESS[role]?.includes(area) ?? false;
}

/** 현재 로그인한 관리자 (없거나 일반 회원이면 null) */
export async function getStaff(): Promise<Staff | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", user.id)
    .single();

  if (!data || data.role === "customer") return null;
  return data as Staff;
}

/** 관리자 페이지 보호 */
export async function requireStaff(area?: StaffArea): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login?denied=1");
  if (area && !can(staff.role, area)) redirect("/admin?denied=1");
  return staff;
}