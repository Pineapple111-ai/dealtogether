"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const NAVER_ID = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID;

declare global {
  interface Window {
    wcs?: { inflow?: (d?: string) => void };
    wcs_add?: Record<string, string>;
    wcs_do?: () => void;
  }
}

// 같은 페이지 중복 기록 방지
let lastNaverPath = "";
let lastSelfPath = "";

function trackNaver() {
  if (!NAVER_ID || !window.wcs_do) return;
  const path = window.location.pathname + window.location.search;
  if (path === lastNaverPath) return;
  lastNaverPath = path;
  window.wcs_add = window.wcs_add || {};
  window.wcs_add["wa"] = NAVER_ID;
  window.wcs?.inflow?.("dealtogether.kr");
  window.wcs_do();
}

/** 자체 방문 집계 (관리자 방문 통계용) */
function trackSelf(path: string) {
  if (path === lastSelfPath) return;
  lastSelfPath = path;
  try {
    let vid = localStorage.getItem("dt_vid");
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem("dt_vid", vid);
    }
    // 유입 경로는 방문(세션)의 첫 페이지에서만
    let ref = "";
    if (!sessionStorage.getItem("dt_ref_sent")) {
      ref = document.referrer;
      sessionStorage.setItem("dt_ref_sent", "1");
    }
    const data = JSON.stringify({ path, vid, ref });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([data], { type: "text/plain" }));
    else fetch("/api/track", { method: "POST", body: data, keepalive: true });
  } catch {
    /* 저장 불가 환경 */
  }
}

/** 고객 화면에서만 GA4·네이버·자체 집계 (관리자 화면 제외) */
export default function Analytics() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;
    trackSelf(pathname);
    const t = setTimeout(trackNaver, 300);
    return () => clearTimeout(t);
  }, [pathname, isAdmin]);

  if (isAdmin) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}
      {NAVER_ID && <Script src="https://wcs.naver.net/wcslog.js" strategy="afterInteractive" onLoad={trackNaver} />}
    </>
  );
}