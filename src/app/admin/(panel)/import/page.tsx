import { Suspense } from "react";
import { connection } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import ImportTool from "@/components/admin/ImportTool";

export default function AdminImportPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">상품 일괄 등록</h1>
      <p className="mt-1 text-sm text-sub">엑셀 파일 하나로 제품 · 모델 · SKU · 재고 · 쇼핑몰 가격 · 설치 옵션을 한 번에 등록·수정합니다.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-white" />}>
        <Guarded />
      </Suspense>
    </div>
  );
}

async function Guarded() {
  await connection();
  await requireStaff("products");
  return (
    <div className="mt-6">
      <ImportTool />
    </div>
  );
}