"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Receipt, Megaphone, Package, Boxes, Users, Headphones, FileText, Settings, LogOut, Percent, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MENU = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, area: "dashboard", ready: true },
  { href: "/admin/orders", label: "주문·결제", icon: Receipt, area: "orders", ready: true },
  { href: "/admin/campaigns", label: "공동구매 캠페인", icon: Megaphone, area: "campaigns", ready: true },
  { href: "/admin/packages", label: "패키지", icon: Package, area: "products", ready: true },
  { href: "/admin/products", label: "제품·옵션", icon: Boxes, area: "products", ready: true },
  { href: "/admin/import", label: "상품 일괄 등록", icon: FileSpreadsheet, area: "products", ready: true },
  { href: "/admin/discounts", label: "세트 할인", icon: Percent, area: "products", ready: true },
  { href: "/admin/members", label: "회원", icon: Users, area: "members", ready: true },
  { href: "/admin/inquiries", label: "상담", icon: Headphones, area: "cs", ready: true },
  { href: "/admin/content", label: "콘텐츠", icon: FileText, area: "content", ready: true },
  { href: "/admin/settings", label: "설정", icon: Settings, area: "settings", ready: true },
] as const;

export default function AdminNav({ areas, name, roleLabel }: { areas: string[]; name: string; roleLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <aside className="flex w-full flex-col border-b border-white/10 bg-navy text-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-b-0">
      <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
        <Link href="/admin" className="text-lg font-extrabold">딜투게더 <span className="text-sm font-semibold text-white/60">관리자</span></Link>
        <p className="hidden text-xs text-white/60 lg:mt-1 lg:block">{name} · {roleLabel}</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="관리자 메뉴">
        {MENU.filter((m) => areas.includes(m.area)).map((m) => {
          const active = m.href === "/admin" ? pathname === "/admin" : pathname.startsWith(m.href);
          const Icon = m.icon;
          if (!m.ready) {
            return (
              <span key={m.href} className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/35">
                <Icon size={17} /> {m.label}
                <span className="ml-auto hidden text-[10px] lg:inline">준비 중</span>
              </span>
            );
          }
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                active ? "bg-white text-navy" : "text-white/85 hover:bg-white/10"
              }`}
            >
              <Icon size={17} /> {m.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-white/10 p-3 lg:block">
        <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">쇼핑몰 보기</Link>
        <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10">
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </aside>
  );
}