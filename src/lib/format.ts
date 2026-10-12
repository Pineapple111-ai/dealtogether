/** 3500000 → "3,500,000원" */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 할인율 (정수 %) */
export function discountRate(listPrice: number, salePrice: number): number {
  if (listPrice <= 0 || salePrice >= listPrice) return 0;
  return Math.floor(((listPrice - salePrice) / listPrice) * 100);
}

/** KST 날짜 표시 */
export function formatDate(iso: string, withTime = true): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(iso));
}