/** 사이트 기본 주소 (도메인 변경 시 NEXT_PUBLIC_SITE_URL만 바꾸면 됨) */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dealtogether.netlify.app").replace(/\/$/, "");