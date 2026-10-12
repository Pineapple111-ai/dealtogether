import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "관리자 로그인", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-soft px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}