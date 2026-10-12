import { z } from "zod";

/** 입력값 → 010-xxxx-xxxx 형태로 자동 하이픈 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 숫자만 (비회원 식별 키 등) */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

/** 서버/클라이언트 공통 검증 */
export const phoneSchema = z
  .string()
  .transform(formatPhone)
  .refine((v) => PHONE_REGEX.test(v), {
    message: "휴대폰 번호를 010-0000-0000 형식으로 입력해주세요.",
  });