import { Suspense } from "react";
import type { Metadata } from "next";
import CustomerLoginForm from "@/components/auth/CustomerLoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 md:py-24">
      <Suspense fallback={null}>
        <CustomerLoginForm />
      </Suspense>
    </div>
  );
}