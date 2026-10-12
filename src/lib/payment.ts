/** HTTPS + 승인 도메인 검사 (목록이 비어 있으면 HTTPS만 검사) */
export function isAllowedPaymentUrl(url: string, allowedDomains: string[]) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (allowedDomains.length === 0) return true;
    const host = u.hostname.toLowerCase();
    return allowedDomains.some((d) => {
      const dd = d.trim().toLowerCase();
      return dd && (host === dd || host.endsWith("." + dd));
    });
  } catch {
    return false;
  }
}

/** 우선순위: 캠페인 → 브랜드 → 사이트 공통. 처음 등록된 URL이 유효하지 않으면 차단(null) */
export function resolvePaymentUrl(
  campaignUrl: string | null,
  brandUrl: string | null,
  siteUrl: string | null,
  allowedDomains: string[]
): string | null {
  for (const raw of [campaignUrl, brandUrl, siteUrl]) {
    const url = raw?.trim();
    if (url) return isAllowedPaymentUrl(url, allowedDomains) ? url : null;
  }
  return null;
}