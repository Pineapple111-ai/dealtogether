import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FooterGate from "@/components/layout/FooterGate";

export const metadata: Metadata = {
  title: {
    default: "딜투게더 | 프리미엄 가전 공동구매",
    template: "%s | 딜투게더",
  },
  description: "좋은 가전, 더 좋은 가격. 삼성·LG 가전 패키지 공동구매 딜투게더.",
  openGraph: {
    title: "딜투게더 | 프리미엄 가전 공동구매",
    description: "좋은 가전, 더 좋은 가격. 함께하는 딜투게더.",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="bg-white" style={{ colorScheme: "light" }}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-white text-ink antialiased">
        <Suspense fallback={<div className="h-16 border-b border-line md:h-[109px]" />}>
          <Header />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Suspense fallback={null}>
          <FooterGate>
            <Footer />
          </FooterGate>
        </Suspense>
      </body>
    </html>
  );
}