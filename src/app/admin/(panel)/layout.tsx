import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import AdminNav from "@/components/admin/AdminNav";
import { requireStaff, can, ROLE_LABEL, type StaffArea } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "관리자", robots: { index: false } };

const AREAS: StaffArea[] = ["dashboard", "orders", "campaigns", "products", "members", "cs", "content", "settings"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-soft" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh bg-soft lg:flex">
      <AdminNav
        areas={AREAS.filter((a) => can(staff.role, a))}
        name={staff.name ?? staff.email ?? "관리자"}
        roleLabel={ROLE_LABEL[staff.role]}
      />
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}