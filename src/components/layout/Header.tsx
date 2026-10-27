"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Menu, X, User, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import Image from "next/image";

const NAV = [
  { href: "/campaigns", label: "전체 공동구매" },
  { href: "/store", label: "가전 쇼핑" },
  { href: "/brands/samsung", label: "삼성 가전" },
  { href: "/brands/lg", label: "LG 가전" },
  { href: "/categories", label: "공간별 패키지" },
  { href: "/closing-soon", label: "마감 임박" },
  { href: "/guide", label: "이용안내" },
  { href: "/support", label: "고객센터" },
];

function useLoggedIn() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  return loggedIn;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const cart = useCart();
  const cartCount = cart?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  const logout = async () => {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      {/* 유틸 바 */}
      <div className="hidden border-b border-line md:block">
        <div className="mx-auto flex h-9 max-w-site items-center justify-end gap-5 px-6 text-[13px] text-sub">
          {loggedIn === null ? null : loggedIn ? (
            <>
              <Link href="/mypage" className="hover:text-ink">마이페이지</Link>
              <button type="button" onClick={logout} className="hover:text-ink">로그아웃</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-ink">로그인</Link>
              <Link href="/signup" className="hover:text-ink">회원가입</Link>
              <Link href="/order-lookup" className="hover:text-ink">비회원 주문조회</Link>
            </>
          )}
          <Link href="/support" className="hover:text-ink">고객센터</Link>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-site items-center gap-8 px-4 md:h-[72px] md:px-6">
        <Link href="/" className="shrink-0" aria-label="딜투게더 홈">
          <Image src="/images/logo.png" alt="딜투게더" width={334} height={80} loading="eager" className="h-8 w-auto md:h-9" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="주요 메뉴">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`text-[15px] font-semibold transition-colors ${
                  active ? "text-navy" : "text-ink/80 hover:text-navy"
                } ${n.href === "/closing-soon" ? "text-coral hover:text-coral-600" : ""}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link href="/search" aria-label="검색" className="grid h-10 w-10 place-items-center rounded-full hover:bg-soft">
            <Search size={20} />
          </Link>
          <Link href="/cart" aria-label="장바구니" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-soft">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="tabular absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <Link href={loggedIn ? "/mypage" : "/login"} aria-label="마이페이지" className="grid h-10 w-10 place-items-center rounded-full hover:bg-soft">
            <User size={20} />
          </Link>
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-soft lg:hidden"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-white">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Image src="/images/logo.png" alt="딜투게더" width={334} height={80} className="h-7 w-auto" />
              <button type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center">
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-5 py-3" aria-label="모바일 메뉴">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block border-b border-line py-4 text-[16px] font-semibold">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-5">
              {loggedIn ? (
                <>
                  <Link href="/mypage" className="rounded-lg bg-navy py-3 text-center text-sm font-semibold text-white">마이페이지</Link>
                  <button type="button" onClick={logout} className="rounded-lg border border-line py-3 text-sm font-semibold">로그아웃</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-lg border border-line py-3 text-center text-sm font-semibold">로그인</Link>
                  <Link href="/signup" className="rounded-lg bg-navy py-3 text-center text-sm font-semibold text-white">회원가입</Link>
                  <Link href="/order-lookup" className="col-span-2 py-2 text-center text-sm text-sub">비회원 주문조회</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}