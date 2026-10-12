"use client";

import { usePathname } from "next/navigation";

/** 관리자 영역에서는 푸터 숨김 */
export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}